"use client";

import { useState, useRef, useCallback } from "react";
import { LeadRow } from "@/actions/domain-scrape.actions";
import { SaveLeadsModal } from "@/components/scraping/SaveLeadsModal";
import { ScrapingTrivia } from "@/components/scraping/ScrapingTrivia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2, StopCircle, Save,
  Copy, Trash2, Globe, ExternalLink, Mail, Phone,
} from "lucide-react";
import { toast } from "sonner";

interface TableRow extends LeadRow {
  id: number;
  selected: boolean;
}

type CrawlStatus = "idle" | "crawling" | "done" | "stopped";

// ─── Pagination URL helpers ───────────────────────────────────────────────────

type PageParam = { key: string; value: number; isPath: boolean };

function detectPageParam(url: string): PageParam | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    for (const key of ["page", "p", "pg", "paged", "pagenum", "page_num", "pageNo", "pg_num"]) {
      const val = u.searchParams.get(key);
      if (val !== null && /^\d+$/.test(val)) return { key, value: parseInt(val, 10), isPath: false };
    }
    const m = u.pathname.match(/\/pages?\/(\d+)\/?$/i) ?? u.pathname.match(/\/(\d+)\/?$/);
    if (m) return { key: "path", value: parseInt(m[1], 10), isPath: true };
  } catch { /* ignore */ }
  return null;
}

function buildPageUrl(baseUrl: string, p: PageParam, page: number): string {
  const u = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);
  if (!p.isPath) {
    u.searchParams.set(p.key, String(page));
  } else {
    u.pathname = u.pathname
      .replace(/\/pages?\/\d+\/?$/i, `/page/${page}`)
      .replace(/\/\d+\/?$/, `/${page}`);
  }
  return u.toString();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DomainScrapeForm() {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [status, setStatus] = useState<CrawlStatus>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [summary, setSummary] = useState<{ leadsFound: number; pagesVisited: number; elapsed: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [urlsValue, setUrlsValue] = useState("");
  const [withPagination, setWithPagination] = useState(false);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [totalUrls, setTotalUrls] = useState(0);
  const [autoPaginationPage, setAutoPaginationPage] = useState<number | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const rowCounter = useRef(0);
  const abortRef = useRef(false);

  const stopCrawl = useCallback(() => {
    abortRef.current = true;
    sourceRef.current?.close();
    sourceRef.current = null;
    setStatus((s) => s === "crawling" ? "stopped" : s);
  }, []);

  function crawlUrl(url: string, maxLeads: string, timeLimit: string): Promise<{ notFound: boolean }> {
    return new Promise((resolve) => {
      const params = new URLSearchParams({ url, maxLeads, timeLimit });
      const es = new EventSource(`/api/scraping/stream?${params}`);
      sourceRef.current = es;
      let notFound = false;

      es.addEventListener("status", (e) => {
        setStatusMsg(JSON.parse(e.data).message);
      });
      es.addEventListener("lead", (e) => {
        const lead = JSON.parse(e.data) as LeadRow;
        const id = ++rowCounter.current;
        setRows((prev) => [...prev, { ...lead, id, selected: true }]);
      });
      es.addEventListener("notfound", () => { notFound = true; });
      es.addEventListener("done", () => {
        es.close();
        sourceRef.current = null;
        resolve({ notFound });
      });
      es.addEventListener("error", (e: Event) => {
        const msgEvent = e as MessageEvent;
        if (msgEvent.data) {
          const parsed = JSON.parse(msgEvent.data) as { message: string };
          setErrorMsg(parsed.message);
        }
        es.close();
        sourceRef.current = null;
        resolve({ notFound });
      });
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    stopCrawl();
    const fd = new FormData(e.currentTarget);
    const rawUrls = (fd.get("urls") as string).trim();
    const maxLeads = fd.get("maxLeads") as string;
    const timeLimit = fd.get("timeLimit") as string;

    const urls = rawUrls.split(/\n/).map(u => u.trim()).filter(Boolean);
    if (!urls.length) return;

    setRows([]);
    setSummary(null);
    setErrorMsg("");
    setStatus("crawling");
    setStatusMsg("Connecting…");
    rowCounter.current = 0;
    abortRef.current = false;
    setAutoPaginationPage(null);

    const startTime = Date.now();
    let totalPagesVisited = 0;

    if (withPagination && urls.length === 1) {
      // ── Auto-pagination mode ──────────────────────────────────────────────
      const baseUrl = urls[0];
      const detected = detectPageParam(baseUrl);
      if (!detected) {
        // No page param found — just crawl once as normal
        setTotalUrls(1);
        setCurrentUrlIndex(1);
        await crawlUrl(baseUrl, maxLeads, timeLimit);
        totalPagesVisited = 1;
      } else {
        let page = detected.value;
        const MAX_AUTO_PAGES = 99;
        setTotalUrls(0); // unknown until we stop
        while (!abortRef.current && page < detected.value + MAX_AUTO_PAGES) {
          const pageUrl = buildPageUrl(baseUrl, detected, page);
          setAutoPaginationPage(page);
          setStatusMsg(`Page ${page}: connecting…`);
          const { notFound } = await crawlUrl(pageUrl, maxLeads, timeLimit);
          totalPagesVisited++;
          if (notFound) break;
          page++;
        }
        setAutoPaginationPage(null);
      }
    } else {
      // ── Multi-URL sequential mode ─────────────────────────────────────────
      setTotalUrls(urls.length);
      for (let i = 0; i < urls.length; i++) {
        if (abortRef.current) break;
        setCurrentUrlIndex(i + 1);
        setStatusMsg(`[${i + 1}/${urls.length}] Crawling ${urls[i]}…`);
        await crawlUrl(urls[i], maxLeads, timeLimit);
        totalPagesVisited++;
      }
    }

    setSummary({
      leadsFound: rowCounter.current,
      pagesVisited: totalPagesVisited,
      elapsed: Math.round((Date.now() - startTime) / 1000),
    });
    setStatus("done");
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
  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  const isCrawling = status === "crawling";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Scraped Leads</h2>
          <p className="text-sm text-muted-foreground">
            Enter a domain — leads stream into the table in real-time.
          </p>
        </div>
        {rows.length > 0 && (
          <Button onClick={openSaveModal} disabled={selectedCount === 0} size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save Selected ({selectedCount})
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
            <textarea
              name="urls"
              value={urlsValue}
              onChange={e => setUrlsValue(e.target.value)}
              placeholder={
                withPagination
                  ? "https://example.com/agents?page=1\n(DataForge will auto-increment the page number)"
                  : "https://example.com/directory\nhttps://example.com/directory?page=2\nhttps://example.com/directory?page=3"
              }
              required
              rows={withPagination ? 2 : 3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="withPagination"
                checked={withPagination}
                onCheckedChange={(v) => setWithPagination(!!v)}
              />
              <label htmlFor="withPagination" className="text-xs text-muted-foreground cursor-pointer select-none">
                With pagination — auto-increment page number until 404
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Input
                name="maxLeads"
                type="number"
                min={1}
                max={200}
                defaultValue={50}
                className="w-20 text-center"
                aria-label="Max leads"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">leads / page</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                name="timeLimit"
                type="number"
                min={10}
                max={300}
                defaultValue={60}
                className="w-20 text-center"
                aria-label="Time limit"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">sec / page</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 justify-start pt-0.5">
            <Button type="submit" size="sm" disabled={isCrawling}>
              {isCrawling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isCrawling ? "Crawling…" : "Start Crawl"}
            </Button>
            {isCrawling && (
              <Button type="button" variant="outline" size="sm" onClick={stopCrawl}>
                <StopCircle className="h-4 w-4 mr-1.5" />
                Stop
              </Button>
            )}
          </div>
        </div>
        {isCrawling && (
          <div className="flex items-center gap-2">
            {autoPaginationPage !== null && (
              <Badge variant="outline" className="text-xs py-0 font-mono animate-pulse">
                Page {autoPaginationPage}
              </Badge>
            )}
            {totalUrls > 1 && autoPaginationPage === null && (
              <Badge variant="outline" className="text-xs py-0 font-mono animate-pulse">
                URL {currentUrlIndex}/{totalUrls}
              </Badge>
            )}
            {statusMsg && (
              <span className="text-xs text-muted-foreground truncate">{statusMsg}</span>
            )}
          </div>
        )}
      </form>

      <ScrapingTrivia visible={isCrawling} />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                  disabled={rows.length === 0}
                />
              </TableHead>
              <TableHead className="w-10 text-muted-foreground font-normal">#</TableHead>
              <TableHead>Business Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-32 text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  {isCrawling ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Looking for leads…
                    </span>
                  ) : errorMsg ? (
                    <span className="flex flex-col items-center justify-center gap-1 text-destructive">
                      <span className="font-medium">Crawl failed</span>
                      <span className="text-xs max-w-md text-center">{errorMsg}</span>
                    </span>
                  ) : status === "done" ? (
                    <span className="flex flex-col items-center justify-center gap-1">
                      <Globe className="h-4 w-4" />
                      <span>No leads found. The site may require JavaScript or block automated requests.</span>
                      <span className="text-xs">Try a smaller business site or directory that doesn&apos;t use Cloudflare.</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Globe className="h-4 w-4" />
                      Enter a URL and start crawling to see results here.
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.selected ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={row.selected}
                      onCheckedChange={() => toggleRow(row.id)}
                      aria-label="Select row"
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {row.id}
                  </TableCell>
                  <TableCell className="font-medium max-w-[160px]">
                    <span className="truncate block">{row.businessName}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.contactPerson ?? <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[160px]">
                    <span className="truncate block">
                      {row.address
                        ? row.address
                        : row.city
                          ? `${row.city}${row.state ? `, ${row.state}` : ""}`
                          : <span className="text-muted-foreground/40">—</span>}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.website ? (
                      <a
                        href={`https://${row.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-500 hover:underline"
                      >
                        {row.website}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {row.phone ?? <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.email ?? <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell className="text-right pr-3">
                    <TooltipProvider delayDuration={200}>
                      <div className="flex items-center justify-end gap-0.5">
                        {row.email && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => copyText(row.email!, "Email")}
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Copy email</TooltipContent>
                          </Tooltip>
                        )}
                        {row.phone && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => copyText(row.phone!, "Phone")}
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Copy phone</TooltipContent>
                          </Tooltip>
                        )}
                        {row.website && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => copyText(`https://${row.website}`, "Website")}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Copy website</TooltipContent>
                          </Tooltip>
                        )}
                        {row.website && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={`https://${row.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  type="button"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </a>
                            </TooltipTrigger>
                            <TooltipContent side="top">Open website</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeRow(row.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Remove row</TooltipContent>
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

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          {selectedCount} of {rows.length} lead{rows.length !== 1 ? "s" : ""} selected
          {summary && (
            <span className="ml-3">
              · {summary.pagesVisited} pages · {summary.elapsed}s
            </span>
          )}
          {isCrawling && (
            <Badge variant="outline" className="ml-2 text-xs py-0 animate-pulse">
              Live
            </Badge>
          )}
          {status === "done" && rows.length > 0 && (
            <Badge variant="outline" className="ml-2 text-xs py-0">
              Done
            </Badge>
          )}
          {status === "stopped" && rows.length > 0 && (
            <Badge variant="outline" className="ml-2 text-xs py-0">
              Stopped
            </Badge>
          )}
        </span>
        {rows.length > 0 && (
          <Button onClick={openSaveModal} disabled={selectedCount === 0} size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save Selected ({selectedCount})
          </Button>
        )}
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
