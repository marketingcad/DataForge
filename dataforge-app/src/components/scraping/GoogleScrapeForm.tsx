"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { LeadRow } from "@/actions/domain-scrape.actions";
import { SaveLeadsModal } from "@/components/scraping/SaveLeadsModal";
import { ScrapingTrivia } from "@/components/scraping/ScrapingTrivia";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2, StopCircle, Save, Copy, Trash2, Globe,
  ExternalLink, Mail, Phone, PlayCircle, RotateCcw, Plus, X,
} from "lucide-react";
import { toast } from "sonner";

interface TableRow extends LeadRow {
  id: number;
  selected: boolean;
}

type CrawlStatus = "idle" | "crawling" | "done" | "stopped";

interface TabMeta {
  status: CrawlStatus;
  count: number;
}

// ── Individual crawl instance ────────────────────────────────────────────────


function CrawlInstance({
  hidden,
  onUpdate,
}: {
  hidden: boolean;
  onUpdate: (status: CrawlStatus, count: number) => void;
  tabCount: number;
}) {
  const [rows,      setRows]      = useState<TableRow[]>([]);
  const [status,    setStatus]    = useState<CrawlStatus>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg,  setErrorMsg]  = useState("");
  const [summary,   setSummary]   = useState<{ leadsFound: number; pagesVisited: number; elapsed: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [maxLeads,  setMaxLeads]  = useState(50);
  const [timeLimit, setTimeLimit] = useState(0);

  // No auto-adjust — user controls the time limit manually

  const sourceRef  = useRef<EventSource | null>(null);
  const rowCounter = useRef(0);
  const urlRef     = useRef<HTMLTextAreaElement>(null);

  // Notify parent whenever status or lead count changes.
  // Use a ref so the effect never re-runs just because the parent re-renders
  // (which would create a new inline arrow and cause an infinite loop).
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; });
  useEffect(() => {
    onUpdateRef.current(status, rows.length);
  }, [status, rows.length]);

  const stopCrawl = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setStatus((s) => (s === "crawling" ? "stopped" : s));
  }, []);

  function startCrawl() {
    const raw = urlRef.current?.value.trim() ?? "";
    if (!raw) { toast.error("Paste a Google search URL first."); return; }

    stopCrawl();
    setRows([]);
    setSummary(null);
    setErrorMsg("");
    setStatus("crawling");
    setStatusMsg("Connecting…");
    rowCounter.current = 0;

    const isGoogleUrl = raw.startsWith("http") && raw.includes("google.");
    const params = new URLSearchParams({
      ...(isGoogleUrl ? { googleUrl: raw } : { query: raw }),
      maxLeads: String(maxLeads),
      timeLimit: String(timeLimit),
    });

    const es = new EventSource(`/api/scraping/google-stream?${params}`);
    sourceRef.current = es;

    es.addEventListener("status", (e) => {
      setStatusMsg((JSON.parse(e.data) as { message: string }).message);
    });

    es.addEventListener("lead", (e) => {
      const lead = JSON.parse(e.data) as LeadRow;
      const id   = ++rowCounter.current;
      setRows((prev) => [...prev, { ...lead, id, selected: true }]);
    });

    es.addEventListener("done", (e) => {
      setSummary(JSON.parse(e.data));
      setStatus("done");
      es.close();
      sourceRef.current = null;
    });

    es.addEventListener("error", (e: Event) => {
      const me = e as MessageEvent;
      if (me.data) {
        setErrorMsg((JSON.parse(me.data) as { message: string }).message);
        setStatus("done");
      } else {
        setStatus("stopped");
      }
      es.close();
      sourceRef.current = null;
    });
  }

  function reset() {
    stopCrawl();
    setRows([]);
    setSummary(null);
    setErrorMsg("");
    setStatus("idle");
    setStatusMsg("");
    rowCounter.current = 0;
    if (urlRef.current) urlRef.current.value = "";
  }

  function toggleRow(id: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function toggleAll() {
    const allSelected = rows.every((r) => r.selected);
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  }

  function openSaveModal() {
    const selected = rows.filter((r) => r.selected);
    if (!selected.length) { toast.error("Select at least one lead."); return; }
    setModalOpen(true);
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  const selectedCount = rows.filter((r) => r.selected).length;
  const allSelected   = rows.length > 0 && rows.every((r) => r.selected);
  const isCrawling    = status === "crawling";

  return (
    <div className={`flex flex-col h-full ${hidden ? "hidden" : ""}`}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between pb-4 border-b mb-0">
        <div>
          <h2 className="text-base font-semibold">Search by Google</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paste a Google search URL — leads are extracted directly from the results page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCrawling && (
            <Button variant="outline" size="sm" onClick={stopCrawl}>
              <StopCircle className="h-4 w-4 mr-1.5" />
              Stop
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={reset} disabled={isCrawling}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Reset
          </Button>
          {rows.length > 0 && (
            <Button size="sm" onClick={openSaveModal} disabled={selectedCount === 0}>
              <Save className="h-4 w-4 mr-1.5" />
              Save Selected ({selectedCount})
            </Button>
          )}
        </div>
      </div>

      {/* ── Body: left panel + right results ── */}
      <div className="flex flex-1 min-h-0 gap-0 mt-0 border rounded-lg overflow-hidden">

        {/* ── Left control panel ── */}
        <div className="w-72 shrink-0 border-r flex flex-col bg-muted/20">
          <div className="flex-1 overflow-y-auto p-5 space-y-6">

            {/* Google URL input */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Google Search URL
              </Label>
              <div className="relative">
                <Textarea
                  ref={urlRef}
                  placeholder={`Paste a Google search result URL here.\n\nExample:\nhttps://www.google.com/search?q=plumbing+companies+in+new+jersey`}
                  className="h-[140px] max-h-[140px] text-xs font-mono resize-none leading-relaxed overflow-y-auto"
                />
                <div className="pointer-events-none absolute bottom-0 inset-x-0 h-8 rounded-b-md bg-gradient-to-t from-background to-transparent" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Open Google, search for your query, then copy and paste the full URL from the address bar.
              </p>
            </div>

            <Separator />

            {/* Max leads slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Max Leads
                </Label>
                <span className="text-sm font-medium tabular-nums">{maxLeads}</span>
              </div>
              <Slider
                min={5} max={200} step={5}
                value={[maxLeads]}
                onValueChange={(v) => setMaxLeads(Array.isArray(v) ? v[0] : v)}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>5</span><span>200</span>
              </div>
            </div>

            {/* Time limit slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Time Limit
                </Label>
                <span className="text-sm font-medium tabular-nums">
                  {timeLimit === 0 ? "No limit" : `${timeLimit}s`}
                </span>
              </div>
              <Slider
                min={0} max={300} step={10}
                value={[timeLimit]}
                onValueChange={(v) => setTimeLimit(Array.isArray(v) ? v[0] : v)}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>No limit</span><span>5m</span>
              </div>
            </div>

            <Separator />

            {/* Status area */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </Label>
              <div className="min-h-[60px] rounded-md bg-background border p-3 text-xs text-muted-foreground leading-relaxed">
                {isCrawling && statusMsg ? (
                  <span className="flex gap-2">
                    <Loader2 className="h-3 w-3 animate-spin shrink-0 mt-0.5" />
                    {statusMsg}
                  </span>
                ) : errorMsg ? (
                  <span className="text-destructive">{errorMsg}</span>
                ) : summary ? (
                  <span>
                    Done — {summary.leadsFound} lead{summary.leadsFound !== 1 ? "s" : ""} extracted in {summary.elapsed}s
                  </span>
                ) : status === "stopped" ? (
                  <span>Stopped.</span>
                ) : (
                  <span>Idle — paste a URL and click Start.</span>
                )}
              </div>
              <ScrapingTrivia visible={isCrawling} interval={4000} />
            </div>
          </div>

          {/* Start button pinned to bottom of panel */}
          <div className="p-4 border-t bg-background">
            <Button className="w-full" onClick={startCrawl} disabled={isCrawling}>
              {isCrawling
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Crawling…</>
                : <><PlayCircle className="h-4 w-4 mr-2" />Start Crawl</>}
            </Button>
          </div>
        </div>

        {/* ── Right: results table ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Table header row */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background shrink-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {rows.length > 0
                  ? `${selectedCount} of ${rows.length} selected`
                  : "No leads yet"}
              </span>
              {isCrawling && (
                <Badge variant="outline" className="text-[11px] py-0 animate-pulse">Live</Badge>
              )}
              {status === "done" && rows.length > 0 && (
                <Badge variant="outline" className="text-[11px] py-0">Done</Badge>
              )}
              {status === "stopped" && rows.length > 0 && (
                <Badge variant="outline" className="text-[11px] py-0">Stopped</Badge>
              )}
            </div>
            {rows.length > 0 && !isCrawling && (
              <Button size="sm" onClick={openSaveModal} disabled={selectedCount === 0}>
                <Save className="h-4 w-4 mr-1.5" />
                Save ({selectedCount})
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 sticky top-0 bg-background">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll}
                      aria-label="Select all" disabled={rows.length === 0} />
                  </TableHead>
                  <TableHead className="w-8 sticky top-0 bg-background text-muted-foreground font-normal">#</TableHead>
                  <TableHead className="sticky top-0 bg-background">Business Name</TableHead>
                  <TableHead className="sticky top-0 bg-background">Contact</TableHead>
                  <TableHead className="sticky top-0 bg-background">Address</TableHead>
                  <TableHead className="sticky top-0 bg-background">Website</TableHead>
                  <TableHead className="sticky top-0 bg-background">Phone</TableHead>
                  <TableHead className="sticky top-0 bg-background">Email</TableHead>
                  <TableHead className="w-28 sticky top-0 bg-background text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-[400px] text-center text-muted-foreground align-middle">
                      {isCrawling ? (
                        <span className="flex flex-col items-center gap-4">
                          <Loader2 className="h-8 w-8 animate-spin" />
                          <span className="text-sm font-medium">Looking for leads…</span>
                          <ScrapingTrivia visible={isCrawling} />
                        </span>
                      ) : errorMsg ? (
                        <span className="flex flex-col items-center gap-2 text-destructive">
                          <span className="font-medium">Crawl failed</span>
                          <span className="text-xs max-w-md">{errorMsg}</span>
                        </span>
                      ) : (
                        <span className="flex flex-col items-center gap-3">
                          <Globe className="h-10 w-10 text-muted-foreground/30" />
                          <span className="text-sm font-medium">Results will appear here</span>
                          <span className="text-xs max-w-xs text-center">
                            Paste a Google search URL in the panel on the left, then click Start Crawl.
                          </span>
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} data-state={row.selected ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox checked={row.selected} onCheckedChange={() => toggleRow(row.id)} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{row.id}</TableCell>
                      <TableCell className="font-medium max-w-[150px]">
                        <span className="truncate block">{row.businessName}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.contactPerson ?? <span className="text-muted-foreground/30">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[140px]">
                        <span className="truncate block">
                          {row.address
                            ? row.address
                            : row.city
                              ? `${row.city}${row.state ? `, ${row.state}` : ""}`
                              : <span className="text-muted-foreground/30">—</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.website ? (
                          <a href={`https://${row.website}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-500 hover:underline">
                            <span className="truncate max-w-[100px] block">{row.website}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : <span className="text-muted-foreground/30">—</span>}
                      </TableCell>
                      <TableCell className="text-sm font-mono whitespace-nowrap">
                        {row.phone ?? <span className="text-muted-foreground/30">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.email ?? <span className="text-muted-foreground/30">—</span>}
                      </TableCell>
                      <TableCell className="text-right pr-2">
                        <TooltipProvider delayDuration={200}>
                          <div className="flex items-center justify-end gap-0.5">
                            {row.email && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => copyText(row.email!, "Email")}>
                                    <Mail className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy email</TooltipContent>
                              </Tooltip>
                            )}
                            {row.phone && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => copyText(row.phone!, "Phone")}>
                                    <Phone className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy phone</TooltipContent>
                              </Tooltip>
                            )}
                            {row.website && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      onClick={() => copyText(`https://${row.website}`, "URL")}>
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Copy URL</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <a href={`https://${row.website}`} target="_blank" rel="noopener noreferrer">
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" type="button">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </Button>
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent>Open site</TooltipContent>
                                </Tooltip>
                              </>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeRow(row.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <SaveLeadsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        leads={rows.filter((r) => r.selected)}
        onSaved={() => {}}
      />
    </div>
  );
}

// ── Tab manager ──────────────────────────────────────────────────────────────

interface Tab {
  id: number;
  label: string;
}

let tabIdCounter = 1;

export function GoogleScrapeForm() {
  const [tabs,      setTabs]      = useState<Tab[]>([{ id: 1, label: "Search 1" }]);
  const [activeId,  setActiveId]  = useState(1);
  const [tabMeta,   setTabMeta]   = useState<Record<number, TabMeta>>({ 1: { status: "idle", count: 0 } });

  function addTab() {
    const id    = ++tabIdCounter;
    const label = `Search ${id}`;
    setTabs((prev) => [...prev, { id, label }]);
    setTabMeta((prev) => ({ ...prev, [id]: { status: "idle", count: 0 } }));
    setActiveId(id);
  }

  function closeTab(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (tabs.length === 1) return; // keep at least one
    const idx     = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);
    setTabMeta((prev) => { const n = { ...prev }; delete n[id]; return n; });
    if (activeId === id) {
      setActiveId(newTabs[Math.max(0, idx - 1)].id);
    }
  }

  function handleUpdate(id: number, status: CrawlStatus, count: number) {
    setTabMeta((prev) => ({ ...prev, [id]: { status, count } }));
  }

  return (
    <div className="flex flex-col h-full gap-0">

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 border-b pb-0 mb-4 overflow-x-auto">
        {tabs.map((tab) => {
          const meta    = tabMeta[tab.id] ?? { status: "idle", count: 0 };
          const isActive = tab.id === activeId;
          const isCrawling = meta.status === "crawling";

          return (
            <button
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              className={[
                "group relative flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-t-md border border-b-0 transition-colors shrink-0",
                isActive
                  ? "bg-background text-foreground border-border -mb-px z-10"
                  : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/70",
              ].join(" ")}
            >
              {/* Crawling dot */}
              {isCrawling && (
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
              )}
              <span className="max-w-[120px] truncate">{tab.label}</span>

              {/* Lead count badge */}
              {meta.count > 0 && !isCrawling && (
                <span className="text-[10px] bg-muted rounded px-1 tabular-nums font-medium">
                  {meta.count}
                </span>
              )}
              {isCrawling && meta.count > 0 && (
                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded px-1 tabular-nums font-medium">
                  {meta.count}
                </span>
              )}

              {/* Close button — only when more than 1 tab */}
              {tabs.length > 1 && (
                <span
                  onClick={(e) => closeTab(tab.id, e)}
                  className="ml-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}

        {/* Add tab button */}
        <button
          onClick={addTab}
          className="flex items-center gap-1 px-2.5 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-t-md transition-colors shrink-0"
          title="Add new crawler"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* ── Instances (all mounted, hidden when not active) ── */}
      <div className="flex-1 min-h-0">
        {tabs.map((tab) => (
          <CrawlInstance
            key={tab.id}
            hidden={tab.id !== activeId}
            tabCount={tabs.length}
            onUpdate={(status, count) => handleUpdate(tab.id, status, count)}
          />
        ))}
      </div>
    </div>
  );
}
