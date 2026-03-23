import { NextRequest } from "next/server";
import {
  sleep, randInt, sse,
  createBrowserContext,
  humanMouseMove, humanScroll,
} from "@/lib/scraping/crawler/core";

export const maxDuration = 300;

interface SerpLead {
  businessName: string;
  website?:     string;
  phone?:       string;
  email?:       string;
  address?:     string;
  city?:        string;
  state?:       string;
  rating?:      string;
  hours?:       string;
  snippet?:     string;
}

// ─── Shared browser-side utility code ────────────────────────────────────────
//
// This string is eval()'d inside every page.evaluate() call so the helpers
// are available in the same scope. Using `var` so eval puts them in scope.

const UTILS = `
var SKIP_HOSTS = ["google.","goo.gl","youtube.","facebook.","twitter.","x.com",
                  "instagram.","linkedin.","pinterest.","tiktok.","snapchat."];
var FIELD_LABELS = ["Address","Phone","Hours","Areas served",
                    "Products and Services","Appointments","Email"];
var realUrl = function(href) {
  try {
    var u = new URL(href, location.origin);
    if (u.pathname === "/url") {
      var q = u.searchParams.get("q") || u.searchParams.get("url");
      if (q && q.startsWith("http")) return q;
    }
    return u.href;
  } catch(e) { return href; }
};
var isExternal = function(href) {
  try {
    var u = new URL(realUrl(href));
    return u.protocol.startsWith("http") &&
      !SKIP_HOSTS.some(function(h){ return u.hostname.indexOf(h) !== -1; });
  } catch(e) { return false; }
};
var extractHost = function(href) {
  try { return new URL(realUrl(href)).hostname.replace(/^www\\./, ""); }
  catch(e) { return ""; }
};
var parseField = function(text, label) {
  var lines = text.split("\\n").map(function(l){ return l.trim(); }).filter(Boolean);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var re = new RegExp("^" + label + "\\\\s*:?\\\\s*(.+)$", "i");
    var m = line.match(re);
    if (m) return m[1].trim();
    if (line.replace(/:$/, "").toLowerCase() === label.toLowerCase()) {
      var next = lines[i + 1] || "";
      var isLabel = FIELD_LABELS.some(function(l){
        return next.replace(/:$/, "").toLowerCase() === l.toLowerCase();
      });
      if (next && !isLabel) return next;
    }
  }
  return undefined;
};
var parseAddr = function(addr) {
  if (!addr) return {};
  var parts = addr.split(",").map(function(p){ return p.trim(); });
  for (var i = parts.length - 1; i >= 0; i--) {
    var m = parts[i].match(/^([A-Z]{2})\\s+\\d{5}/) || parts[i].match(/^([A-Z]{2})$/);
    if (m) return { city: parts[i-1] || undefined, state: m[1] };
  }
  return {};
};
`;

// ─── Popup data extractor (shared between first attempt and retry) ─────────────

async function readPopupData(
  page: import("playwright").Page,
  businessName: string,
  utils: string
): Promise<{
  phone?: string; email?: string; website?: string;
  address?: string; city?: string; state?: string;
  hours?: string; rating?: string;
} | null> {
  return page.evaluate(function(args: [string, string]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var parseField: (text: string, label: string) => string | undefined = null as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var isExternal: (href: string) => boolean = null as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var extractHost: (href: string) => string = null as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var realUrl: (href: string) => string = null as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var parseAddr: (text: string) => { city?: string; state?: string } = null as any;
    var u = args[0]; var bname = args[1];
    eval(u);

    var popup = document.querySelector("g-sticky-content-container") as HTMLElement | null;
    if (!popup || !(popup.innerText || "").trim()) return null;

    var nameLower = bname.toLowerCase().trim();
    var container: HTMLElement = popup;
    var blocks = Array.prototype.slice.call(popup.querySelectorAll("block-component")) as HTMLElement[];

    var findBlock = function(exact: boolean): HTMLElement | null {
      for (var b = 0; b < blocks.length; b++) {
        var els = Array.prototype.slice.call(
          blocks[b].querySelectorAll("h1,h2,h3,h4,[role='heading'],.kp-header")
        ) as HTMLElement[];
        for (var h = 0; h < els.length; h++) {
          var t = (els[h].innerText || "").trim().toLowerCase();
          if (!t || t.length < 2) continue;
          if (exact ? t === nameLower : (t.includes(nameLower) || nameLower.includes(t))) return blocks[b];
        }
      }
      return null;
    };
    var matched = findBlock(true) || findBlock(false);
    if (matched) container = matched;

    var fullText = container.innerText || "";
    var allLinks = Array.prototype.slice.call(container.querySelectorAll("a[href]")) as HTMLAnchorElement[];

    var telLink = container.querySelector('a[href^="tel:"]') as HTMLAnchorElement | null;
    var phone: string | undefined = (telLink?.href ? telLink.href.replace(/^tel:/i, "").trim() : undefined) || undefined;
    if (!phone) phone = parseField(fullText, "Phone");
    if (!phone) { var pm = fullText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/); if (pm) phone = pm[0].trim(); }

    var mailtoLink = container.querySelector('a[href^="mailto:"]') as HTMLAnchorElement | null;
    var email: string | undefined = (mailtoLink?.href ? mailtoLink.href.replace(/^mailto:/i, "").split("?")[0].trim() : undefined) || undefined;

    var siteLink: HTMLAnchorElement | undefined = allLinks.find(function(a) {
      return ((a.innerText || (a as HTMLElement).textContent) || "").trim().toLowerCase() === "website" && isExternal(a.href);
    });
    if (!siteLink) {
      var psVal = parseField(fullText, "Products and Services");
      if (psVal) siteLink = allLinks.find(function(a) { return isExternal(a.href) && ((a.innerText || "").trim() === psVal || extractHost(a.href) === psVal!.replace(/^www\./, "")); });
    }
    if (!siteLink) siteLink = allLinks.find(function(a) { if (!isExternal(a.href)) return false; var r = realUrl(a.href); return r.indexOf("/maps/") === -1 && r.indexOf("maps.google.") === -1; });

    var address: string | undefined = parseField(fullText, "Address") || undefined;
    var addrParsed = parseAddr(address || "");
    var hours: string | undefined = parseField(fullText, "Hours") || undefined;

    var rating: string | undefined;
    var rEl = container.querySelector('[aria-label*="Rated"],[aria-label*="stars"]') as HTMLElement | null;
    if (rEl) { var rm = (rEl.getAttribute("aria-label") || "").match(/(\d+\.?\d*)/); if (rm) rating = rm[1]; }

    return {
      phone, email,
      website: siteLink ? extractHost(siteLink.href) : undefined,
      address, city: addrParsed.city, state: addrParsed.state,
      hours, rating,
    };
  }, [utils, businessName] as [string, string]);
}

// ─── Google SERP extractor ────────────────────────────────────────────────────

async function extractFromSerp(
  queryOrUrl: string,
  context: import("playwright").BrowserContext,
  emit: (event: string, data: unknown) => void,
  maxLeads: number
): Promise<number> {
  const page = await context.newPage();
  let leadsEmitted = 0;

  try {
    // ── Navigate ──────────────────────────────────────────────────────────────
    const isDirectUrl = queryOrUrl.startsWith("http") && queryOrUrl.includes("google.");

    if (isDirectUrl) {
      emit("status", { message: "Navigating to Google search results…" });
      await page.goto(queryOrUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    } else {
      emit("status", { message: `Searching Google for: "${queryOrUrl}"…` });
      await page.goto("https://www.google.com", { waitUntil: "domcontentloaded", timeout: 20000 });
      await sleep(randInt(600, 1000));
      await humanMouseMove(page);
      const searchBox = page.locator('textarea[name="q"], input[name="q"]').first();
      await searchBox.click();
      await sleep(randInt(150, 350));
      for (const char of queryOrUrl) {
        await page.keyboard.type(char, { delay: randInt(40, 110) });
      }
      await sleep(randInt(300, 600));
      await page.keyboard.press("Enter");
    }

    // ── Consent wall ──────────────────────────────────────────────────────────
    await sleep(1500);
    try {
      const btn = page.locator(
        '[id="L2AGLb"], button:has-text("Accept all"), button:has-text("I agree"), ' +
        'button:has-text("Agree"), button:has-text("Accept")'
      ).first();
      if (await btn.isVisible({ timeout: 3000 })) {
        await btn.click();
        await sleep(1000);
        emit("status", { message: "Accepted Google consent…" });
      }
    } catch { /* no consent wall */ }

    // ── Wait for results ──────────────────────────────────────────────────────
    emit("status", { message: "Waiting for results to render…" });
    await page.waitForSelector('[role="heading"], h3, #search, #rso', { timeout: 15000 })
      .catch(() => {});
    await sleep(randInt(800, 1400));

    // ── Scroll to load ALL results (Google lazy-renders below the fold) ───────
    //
    // Local search results are often only partially rendered on first load.
    // We scroll the results panel (and the window) in steps so every result
    // gets a chance to appear in the DOM before we collect headings.
    emit("status", { message: "Scrolling to load all results…" });
    await page.evaluate(async function() {
      var STEP = 400, PAUSE = 250;
      // Candidate scroll containers: Maps panel, regular search, whole body
      var containers: HTMLElement[] = Array.prototype.slice.call(
        document.querySelectorAll('[role="main"], .m6QErb, #search, #rso, #rcnt')
      );
      containers.push(document.documentElement, document.body);

      // Scroll each container that actually has overflow content
      for (var pass = 0; pass < 8; pass++) {
        for (var c = 0; c < containers.length; c++) {
          var el = containers[c];
          if (el && el.scrollHeight > el.clientHeight + 50) {
            el.scrollTop += STEP;
          }
        }
        window.scrollBy(0, STEP);
        await new Promise(function(r) { setTimeout(r, PAUSE); });
      }
    });
    await sleep(800);

    // Scroll back to top so clicks work correctly (index 0 = topmost result)
    await page.evaluate(function() {
      window.scrollTo(0, 0);
      var containers = document.querySelectorAll('[role="main"], .m6QErb, #search, #rso');
      Array.prototype.forEach.call(containers, function(el: HTMLElement) { el.scrollTop = 0; });
    });
    await sleep(500);

    const bodyText = await page.evaluate(() => document.body?.innerText?.toLowerCase() ?? "");
    if (
      bodyText.includes("captcha") ||
      bodyText.includes("unusual traffic") ||
      page.url().includes("sorry/index")
    ) {
      emit("status", { message: "Google showed a CAPTCHA — results may be limited" });
    }

    // ── Step 1: Collect businesses + any data visible in the SERP card ──────────
    //
    // We collect name + whatever phone/address is visible right in the result
    // card (no click needed). This becomes the fallback if the popup fails.

    emit("status", { message: "Reading result list…" });

    type Snippet = { name: string; phone?: string; address?: string; city?: string; state?: string };

    const serpSnippets: Snippet[] = await page.evaluate(function(utils: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      var parseField: (text: string, label: string) => string | undefined = null as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      var parseAddr: (text: string) => { city?: string; state?: string } = null as any;
      eval(utils);

      // Use the most specific results container available; fall back to body
      var root = (
        document.querySelector('[role="main"]') ||
        document.querySelector('#search') ||
        document.querySelector('#rso') ||
        document.body
      ) as HTMLElement;
      var allHeadings = Array.prototype.slice.call(
        root.querySelectorAll('[role="heading"]')
      ).filter(function(el: Element) {
        return !el.querySelector('[role="heading"]');
      }) as HTMLElement[];

      var seen = new Set<string>();
      var results: Array<{ name: string; phone?: string; address?: string; city?: string; state?: string }> = [];

      for (var j = 0; j < allHeadings.length; j++) {
        var el = allHeadings[j];
        var span = el.querySelector("span");
        var name = ((span ? span.innerText : el.innerText) || "").trim();
        if (!name || name.length <= 1) continue;
        if (/^(more places|see (all|more)|sponsored|advertisement|people also|related searches|open now)/i.test(name)) continue;
        if (seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());

        // Walk up to find a result card with enough text lines
        var card: HTMLElement = el;
        for (var k = 0; k < 10 && card.parentElement; k++) {
          card = card.parentElement as HTMLElement;
          if ((card.innerText || "").split("\n").filter(function(s: string) { return s.trim(); }).length >= 4) break;
        }
        var cardText = card.innerText || "";
        var phone: string | undefined = parseField(cardText, "Phone") || undefined;
        if (!phone) {
          var pm = cardText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
          if (pm) phone = pm[0].trim();
        }
        var addr: string | undefined = parseField(cardText, "Address") || undefined;
        var parsed = parseAddr(addr || "");

        results.push({ name, phone, address: addr, city: parsed.city, state: parsed.state });
      }
      return results;
    }, UTILS);

    if (serpSnippets.length === 0) {
      emit("status", { message: "No Places list found — trying knowledge panels…" });
    } else {
      emit("status", { message: `Found ${serpSnippets.length} businesses — loading details…` });
    }

    // ── Step 2: Click each result → enrich with popup data → always emit ──────
    //
    // Every business detected in Step 1 MUST produce a lead row.
    // Popup data enriches it (phone, email, website, full address).
    // If the popup can't be read, the SERP snippet data is used as fallback.
    // A lead is NEVER silently dropped.

    const seenNames = new Set<string>();

    for (let i = 0; i < serpSnippets.length && leadsEmitted < maxLeads; i++) {
      const snippet = serpSnippets[i];
      const name = snippet.name;
      if (seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());

      emit("status", { message: `[${i + 1}/${serpSnippets.length}] ${name}…` });

      // ── Try to click the result heading (up to 2 attempts) ───────────────────
      let clicked = false;
      for (let attempt = 0; attempt < 2 && !clicked; attempt++) {
        try {
          if (attempt > 0) await sleep(1000);
          const safeText = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const heading = page.locator(
            '[role="main"] [role="heading"]:not(:has([role="heading"])), ' +
            '#search [role="heading"]:not(:has([role="heading"])), ' +
            '#rso [role="heading"]:not(:has([role="heading"]))'
          ).filter({ hasText: new RegExp(safeText, "i") }).first();
          await heading.scrollIntoViewIfNeeded({ timeout: 4000 });
          await heading.click({ timeout: 5000, force: true });
          clicked = true;
        } catch { /* retry */ }
      }

      // ── Try to read popup (up to 2 attempts with increasing wait) ────────────
      let popupData: Awaited<ReturnType<typeof readPopupData>> = null;
      if (clicked) {
        await sleep(1800);
        popupData = await readPopupData(page, name, UTILS);
        if (!popupData) {
          await sleep(1500);
          popupData = await readPopupData(page, name, UTILS);
        }
      }

      // ── Always emit — popup enriches the snippet, never drops the lead ───────
      emit("lead", {
        businessName: name,
        website:      popupData?.website ?? "",
        phone:        popupData?.phone ?? snippet.phone,
        email:        popupData?.email,
        address:      popupData?.address ?? snippet.address,
        city:         popupData?.city ?? snippet.city,
        state:        popupData?.state ?? snippet.state,
        hours:        popupData?.hours,
        snippet:      popupData?.rating ? `${popupData.rating} ★` : undefined,
        sourceUrl:    queryOrUrl,
      });
      leadsEmitted++;

      await sleep(randInt(150, 300));
    }

    // ── Tier 2 — data-attrid knowledge panels (fallback) ─────────────────────

    if (leadsEmitted === 0) {
      const tier2: SerpLead[] = await page.evaluate(function(utils: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        var parseField: (t: string, l: string) => string | undefined = null as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        var isExternal: (h: string) => boolean = null as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        var extractHost: (h: string) => string = null as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        var parseAddr: (t: string) => { city?: string; state?: string } = null as any;
        eval(utils);
        var out: Array<{
          businessName: string; phone?: string; address?: string;
          city?: string; state?: string; website?: string; hours?: string;
        }> = [];
        var titleEls = Array.prototype.slice.call(
          document.querySelectorAll('[data-attrid="title"]')
        ) as HTMLElement[];

        for (var j = 0; j < titleEls.length; j++) {
          var titleEl = titleEls[j];
          var nameEl = titleEl.querySelector("span") || titleEl;
          var name = ((nameEl as HTMLElement).innerText || "").trim();
          if (!name || name.length < 2) continue;

          var container: HTMLElement | null = titleEl.parentElement;
          for (var k = 0; k < 6; k++) {
            if (!container) break;
            if (container.querySelectorAll("[data-attrid]").length > 2) break;
            container = container.parentElement;
          }
          if (!container) continue;

          var ft = container.innerText || "";
          var ph = parseField(ft, "Phone");
          var addr = parseField(ft, "Address");
          var ap = parseAddr(addr || "");
          var hrs = parseField(ft, "Hours");
          var links = Array.prototype.slice.call(
            container.querySelectorAll("a[href]")
          ) as HTMLAnchorElement[];
          var siteA = links.find(function(a: HTMLAnchorElement) {
            return isExternal(a.href);
          });
          out.push({
            businessName: name, phone: ph, address: addr,
            city: ap.city, state: ap.state, hours: hrs,
            website: siteA ? extractHost(siteA.href) : undefined,
          });
        }
        return out;
      }, UTILS);

      for (const lead of tier2) {
        if (leadsEmitted >= maxLeads) break;
        emit("lead", { ...lead, website: lead.website ?? "", sourceUrl: queryOrUrl });
        leadsEmitted++;
      }
    }

    // ── Tier 3 — Organic h3 results (last resort) ─────────────────────────────

    if (leadsEmitted === 0) {
      const tier3: SerpLead[] = await page.evaluate(function(utils: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        var isExternal: (h: string) => boolean = null as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        var extractHost: (h: string) => string = null as any;
        eval(utils);
        var out: Array<{ businessName: string; website: string; phone?: string }> = [];
        var allH3s = Array.prototype.slice.call(
          document.querySelectorAll("[data-ved] h3, #search h3, #rso h3, [role='main'] h3")
        ) as HTMLElement[];

        for (var j = 0; j < allH3s.length; j++) {
          var h3 = allH3s[j];
          var name = (h3.innerText || "").trim();
          if (!name || name.length < 2) continue;

          var a: HTMLAnchorElement | null = null;
          var el: HTMLElement | null = h3;
          for (var k = 0; k < 6 && el && !a; k++) {
            var c = ((el.closest as (s: string) => Element | null)("a[href]") ||
                     el.querySelector("a[href]")) as HTMLAnchorElement | null;
            if (c && isExternal(c.href)) { a = c; break; }
            el = el.parentElement as HTMLElement | null;
          }
          if (!a) continue;

          var website = extractHost(a.href);
          var block = ((h3.closest as (s: string) => Element | null)("[data-ved]") ||
                       (h3.parentElement && h3.parentElement.parentElement)) as HTMLElement | null;
          var lines = ((block ? block.innerText : "") || "").split("\n")
            .map(function(l: string) { return l.trim(); }).filter(Boolean);
          var phone: string | undefined;
          var phoneRe = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/;
          for (var m = 0; m < lines.length; m++) {
            if (lines[m].length <= 30 && phoneRe.test(lines[m])) { phone = lines[m]; break; }
          }
          out.push({ businessName: name, website, phone });
        }
        return out;
      }, UTILS);

      for (const lead of tier3) {
        if (leadsEmitted >= maxLeads) break;
        emit("lead", { ...lead, sourceUrl: queryOrUrl });
        leadsEmitted++;
      }
    }

    emit("status", {
      message: `Extracted ${leadsEmitted} result${leadsEmitted !== 1 ? "s" : ""} from Google`,
    });
    return leadsEmitted;

  } catch (err) {
    emit("status", { message: `Extraction error: ${String(err)}` });
    return leadsEmitted;
  } finally {
    await page.close();
  }
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const googleUrl  = (searchParams.get("googleUrl") ?? "").trim();
  const query      = (searchParams.get("query")     ?? "").trim();
  const queryOrUrl = googleUrl || query;
  const maxLeads   = Math.min(parseInt(searchParams.get("maxLeads") ?? "50"), 200);

  if (!queryOrUrl) {
    return new Response(sse("error", { message: "Paste a Google search URL or enter a query" }), {
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const enc  = new TextEncoder();
      const emit = (event: string, data: unknown) => {
        try { controller.enqueue(enc.encode(sse(event, data))); } catch { /* closed */ }
      };

      let browser: import("playwright").Browser | null = null;
      let context: import("playwright").BrowserContext | null = null;

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

      let leadsFound = 0;
      try {
        // extractFromSerp emits leads directly as it scrapes each popup
        leadsFound = await extractFromSerp(queryOrUrl, context!, emit, maxLeads);

        if (leadsFound === 0) {
          emit("error", {
            message:
              "No results extracted. Possible causes: CAPTCHA, not a valid Google search URL, " +
              "or no local results found. Try a Maps URL (google.com/search?q=...&udm=1).",
          });
          return;
        }
      } finally {
        await context?.close().catch(() => {});
        await browser?.close().catch(() => {});
      }

      emit("done", {
        leadsFound,
        pagesVisited: 1,
        elapsed: Math.round((Date.now() - startTime) / 1000),
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
