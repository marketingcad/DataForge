"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Home, RefreshCw, ExternalLink,
  ChevronLeft, ChevronRight, ScanSearch,
} from "lucide-react";

interface PageState {
  screenshot: string; // base64 jpeg
  url: string;
  title: string;
}

interface MiniBufferProps {
  onCrawl: (url: string) => void;
  crawling: boolean;
}

export function MiniBuffer({ onCrawl, crawling }: MiniBufferProps) {
  const [page,     setPage]     = useState<PageState | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [urlInput, setUrlInput] = useState("https://www.google.com");
  const [query,    setQuery]    = useState("");
  const [history,  setHistory]  = useState<string[]>([]);
  const [fwdStack, setFwdStack] = useState<string[]>([]);

  const imgRef   = useRef<HTMLImageElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const navigate = useCallback(async (
    url: string,
    click?: { x: number; y: number },
    pushHistory = true
  ) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/browser/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, click }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(e.error ?? "Navigation failed");
      }

      const data: PageState = await res.json();
      if (pushHistory) {
        setHistory((h) => [...h, url]);
        setFwdStack([]);
      }
      setPage(data);
      setUrlInput(data.url);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Click relay — translate image coordinates to 0-1 percentages
  function handleViewportClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!page || !imgRef.current || loading) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x    = (e.clientX - rect.left) / rect.width;
    const y    = (e.clientY - rect.top)  / rect.height;
    navigate(page.url, { x, y });
  }

  function handleAddressKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    let url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith("http")) url = `https://${url}`;
    navigate(url);
  }

  function handleGoogleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`);
  }

  function goBack() {
    if (history.length < 2) return;
    const prev = history[history.length - 2];
    const cur  = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFwdStack((f) => [cur, ...f]);
    navigate(prev, undefined, false);
  }

  function goForward() {
    if (!fwdStack.length) return;
    const next = fwdStack[0];
    setFwdStack((f) => f.slice(1));
    setHistory((h) => [...h, next]);
    navigate(next, undefined, false);
  }

  function reload() {
    if (page) navigate(page.url, undefined, false);
  }

  return (
    <div className="rounded-lg border overflow-hidden shadow-sm flex flex-col">

      {/* ── Browser chrome ── */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/40 border-b shrink-0">
        {/* Traffic lights — visual only */}
        <div className="flex items-center gap-1.5 mr-1">
          <span className="h-3 w-3 rounded-full bg-red-400/70" />
          <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
          <span className="h-3 w-3 rounded-full bg-green-400/70" />
        </div>

        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={goBack}
          disabled={history.length < 2 || loading} title="Back">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={goForward}
          disabled={!fwdStack.length || loading} title="Forward">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={reload}
          disabled={!page || loading} title="Reload">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
          onClick={() => navigate("https://www.google.com")} disabled={loading} title="Home">
          <Home className="h-3.5 w-3.5" />
        </Button>

        {/* Address bar */}
        <div className="flex-1 flex items-center bg-background border rounded px-2 h-7 gap-1.5">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleAddressKey}
            className="border-0 p-0 h-full text-xs font-mono focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
            placeholder="Type a URL or Google search…"
          />
        </div>

        {page && (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
            onClick={() => window.open(page.url, "_blank")} title="Open in new tab">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* ── Viewport ── */}
      <div className="relative bg-white" style={{ aspectRatio: "16/9" }}>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground px-6">
            <span className="text-sm font-medium text-destructive">Failed to load page</span>
            <span className="text-xs text-center max-w-sm">{error}</span>
            <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
          </div>
        )}

        {/* Google homepage / start screen */}
        {!loading && !error && !page && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8">
            <span className="text-5xl font-bold tracking-tight select-none">
              <span className="text-blue-500">G</span>
              <span className="text-red-500">o</span>
              <span className="text-yellow-500">o</span>
              <span className="text-blue-500">g</span>
              <span className="text-green-500">l</span>
              <span className="text-red-500">e</span>
            </span>
            <form onSubmit={handleGoogleSearch} className="flex w-full max-w-md flex-col items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Google…"
                className="text-center text-sm"
                autoFocus
              />
              <div className="flex gap-2 mt-1">
                <Button type="submit" size="sm" disabled={!query.trim()}>Google Search</Button>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => navigate("https://www.google.com")}>
                  Load Google
                </Button>
              </div>
            </form>
            <p className="text-xs text-muted-foreground">or type any URL in the address bar above</p>
          </div>
        )}

        {/* Screenshot */}
        {page && !error && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={`data:image/jpeg;base64,${page.screenshot}`}
            alt={page.title}
            draggable={false}
            onClick={handleViewportClick}
            className={`w-full h-full object-cover object-top select-none
              ${loading ? "opacity-40 pointer-events-none" : "cursor-pointer"}`}
          />
        )}
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-t bg-muted/30 shrink-0">
        <span className="text-xs text-muted-foreground truncate">
          {page ? page.title || page.url : "No page loaded — search or enter a URL above"}
        </span>
        <Button
          size="sm"
          disabled={!page || crawling || loading}
          onClick={() => page && onCrawl(page.url)}
          className="shrink-0"
        >
          {crawling
            ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Crawling…</>
            : <><ScanSearch className="h-4 w-4 mr-1.5" />Crawl for Leads</>
          }
        </Button>
      </div>
    </div>
  );
}
