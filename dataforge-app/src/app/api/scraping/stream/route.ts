import { NextRequest } from "next/server";
import {
  CRAWLER_UA, MIN_DELAY_MS, MAX_RETRIES,
  FetchResult,
  sleep, jitter, digitsOnly, sse,
  RateLimiter,
  createBrowserContext, fetchPage, extractLinks, parseLead,
} from "@/lib/crawler/core";

export const maxDuration = 60;

const MAX_DEPTH = 3;
const MAX_PAGES = 40;

// ─── robots.txt ───────────────────────────────────────────────────────────────

interface RobotsRules {
  disallowed: string[];
  allowed: string[];
  crawlDelayMs: number;
}

function parseRobotsTxt(text: string): RobotsRules {
  const rules: RobotsRules = { disallowed: [], allowed: [], crawlDelayMs: 0 };
  let applicable = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key   = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    if (key === "user-agent") {
      applicable = value === "*" || value.toLowerCase().includes("dataforge");
      continue;
    }
    if (!applicable) continue;
    if (key === "disallow" && value) rules.disallowed.push(value);
    if (key === "allow"    && value) rules.allowed.push(value);
    if (key === "crawl-delay") {
      const d = parseFloat(value);
      if (!isNaN(d)) rules.crawlDelayMs = d * 1000;
    }
  }
  return rules;
}

async function fetchRobotsTxt(origin: string): Promise<RobotsRules> {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": CRAWLER_UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { disallowed: [], allowed: [], crawlDelayMs: 0 };
    return parseRobotsTxt(await res.text());
  } catch {
    return { disallowed: [], allowed: [], crawlDelayMs: 0 };
  }
}

function isUrlAllowed(url: string, rules: RobotsRules): boolean {
  try {
    const path = new URL(url).pathname;
    for (const a of rules.allowed)    { if (path.startsWith(a)) return true; }
    for (const d of rules.disallowed) { if (d && path.startsWith(d)) return false; }
    return true;
  } catch { return true; }
}

// ─── Queue item ───────────────────────────────────────────────────────────────

interface QueueItem { url: string; depth: number; }

// ─── GET handler ──────────────────────────────────────────────────────────────

import { normalizeWebsite } from "@/lib/utils/normalize";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawUrl       = searchParams.get("url") ?? "";
  const maxLeads     = Math.min(parseInt(searchParams.get("maxLeads") ?? "50"), 200);
  const timeLimitSec = parseInt(searchParams.get("timeLimit") ?? "120");

  const domain = normalizeWebsite(rawUrl);
  if (!domain) {
    return new Response(sse("error", { message: "Invalid URL" }), {
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  let startUrl: string;
  try {
    const parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    startUrl = parsed.toString();
  } catch {
    startUrl = `https://${domain}`;
  }

  const origin      = `https://${domain}`;
  const isHomepage  = startUrl.replace(/\/$/, "") === origin;
  const startTime   = Date.now();
  const timeLimitMs = timeLimitSec * 1000;

  const stream = new ReadableStream({
    async start(controller) {
      const enc  = new TextEncoder();
      const emit = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(sse(event, data)));

      let browser: import("playwright").Browser | null = null;
      let context: import("playwright").BrowserContext | null = null;
      let leadsFound   = 0;
      let pagesVisited = 0;

      try {
        emit("status", { message: "Launching browser…" });
        const bc = await createBrowserContext();
        browser  = bc.browser;
        context  = bc.context;
      } catch (err) {
        emit("error", { message: `Failed to launch browser: ${String(err)}` });
        controller.close();
        return;
      }

      try {
        emit("status", { message: "Reading robots.txt…" });
        const robots     = await fetchRobotsTxt(origin);
        const crawlDelay = Math.max(robots.crawlDelayMs, MIN_DELAY_MS);
        const limiter    = new RateLimiter(crawlDelay);
        if (robots.crawlDelayMs > 0) {
          emit("status", { message: `robots.txt crawl-delay: ${robots.crawlDelayMs / 1000}s — respecting it` });
        }

        const visited = new Set<string>();
        const queue: QueueItem[] = [{ url: startUrl, depth: 0 }];
        if (isHomepage) {
          for (const p of ["/contact", "/contact-us", "/about", "/about-us", "/team"]) {
            const u = `${origin}${p}`;
            if (isUrlAllowed(u, robots)) queue.push({ url: u, depth: 1 });
          }
        }
        const seenEmails = new Set<string>();
        const seenPhones = new Set<string>();

        emit("status", { message: `Starting crawl of ${startUrl}…` });

        while (queue.length > 0 && leadsFound < maxLeads && visited.size < MAX_PAGES) {
          if (Date.now() - startTime > timeLimitMs) {
            emit("status", { message: "Time limit reached." });
            break;
          }

          const item = queue.shift()!;
          if (visited.has(item.url)) continue;
          if (!isUrlAllowed(item.url, robots)) {
            emit("status", { message: `Skipping (disallowed by robots.txt): ${item.url}` });
            continue;
          }
          if (item.depth > MAX_DEPTH) continue;

          visited.add(item.url);
          pagesVisited = visited.size;
          emit("status", { message: `[${pagesVisited}/${MAX_PAGES}] Visiting ${item.url}` });

          await limiter.wait();

          let fetchResult: FetchResult | null = null;
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            fetchResult = await fetchPage(item.url, context!);
            if (fetchResult.ok) break;
            if (fetchResult.reason === "rate_limited") {
              const wait = fetchResult.retryAfterMs ?? 30_000;
              emit("status", { message: `Rate limited — waiting ${Math.round(wait / 1000)}s…` });
              await sleep(wait);
              continue;
            }
            break;
          }

          if (!fetchResult || !fetchResult.ok) {
            const isFirst = visited.size === 1;
            if (fetchResult?.reason === "blocked") {
              const msg = isFirst
                ? "Site blocked the request even with a real browser. It may require a login or use advanced bot protection."
                : `Blocked: ${item.url}`;
              emit(isFirst ? "error" : "status", { message: msg });
              if (isFirst) break;
            } else if (fetchResult?.reason === "rate_limited") {
              emit("status", { message: `Still rate-limited after ${MAX_RETRIES} retries — stopping.` });
              break;
            }
            continue;
          }

          const { html } = fetchResult;
          for (const lead of parseLead(html, item.url)) {
            if (leadsFound >= maxLeads) break;
            const emailKey  = lead.email?.toLowerCase() ?? "";
            const phoneKey  = lead.phone ? digitsOnly(lead.phone) : "";
            const emailSeen = emailKey && seenEmails.has(emailKey);
            const phoneSeen = phoneKey && seenPhones.has(phoneKey);
            if (emailSeen && phoneSeen) continue;
            if (emailSeen && !phoneKey) continue;
            if (phoneSeen && !emailKey) continue;
            if (emailKey) seenEmails.add(emailKey);
            if (phoneKey) seenPhones.add(phoneKey);
            leadsFound++;
            emit("lead", { ...lead, index: leadsFound });
          }

          if (item.depth < MAX_DEPTH) {
            for (const link of extractLinks(html, origin, domain)) {
              if (!visited.has(link) && !queue.some(q => q.url === link) && isUrlAllowed(link, robots)) {
                queue.push({ url: link, depth: item.depth + 1 });
              }
            }
          }

          await jitter(500);
        }
      } finally {
        await context?.close();
        await browser?.close();
      }

      emit("done", { leadsFound, pagesVisited, elapsed: Math.round((Date.now() - startTime) / 1000) });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

