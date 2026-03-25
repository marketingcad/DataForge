import {
  sleep, randInt,
  createBrowserContext,
  humanMouseMove, humanScroll,
} from "@/lib/scraping/crawler/core";

export interface SerpLead {
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
  sourceUrl?:   string;
}

// ─── Shared browser-side utility code ─────────────────────────────────────────
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

export async function extractFromSerp(
  queryOrUrl: string,
  context: import("playwright").BrowserContext,
  emit: (event: string, data: unknown) => void,
  maxLeads: number
): Promise<number> {
  const page = await context.newPage();
  let leadsEmitted = 0;

  try {
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

    // Consent wall
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

    emit("status", { message: "Waiting for results to render…" });
    await page.waitForSelector('[role="heading"], h3, #search, #rso', { timeout: 15000 })
      .catch(() => {});
    await sleep(randInt(800, 1400));
    await humanScroll(page);
    await sleep(randInt(400, 700));

    const bodyText = await page.evaluate(() => document.body?.innerText?.toLowerCase() ?? "");
    if (
      bodyText.includes("captcha") ||
      bodyText.includes("unusual traffic") ||
      page.url().includes("sorry/index")
    ) {
      emit("status", { message: "Google showed a CAPTCHA — results may be limited" });
    }

    emit("status", { message: "Reading result list…" });

    const businessNames: string[] = await page.evaluate(function() {
      var root = document.querySelector("#search") || document.body;
      return Array.prototype.slice.call(root.querySelectorAll('[role="heading"]'))
        .filter(function(el: Element) { return !el.querySelector('[role="heading"]'); })
        .map(function(el: HTMLElement) {
          var span = el.querySelector("span");
          return ((span ? span.innerText : el.innerText) || "").trim();
        })
        .filter(function(name: string) {
          return name.length > 1 &&
            !/^(more places|see (all|more)|sponsored|advertisement|people also|related searches|open now)/i
              .test(name);
        });
    });

    if (businessNames.length === 0) {
      emit("status", { message: "No Places list found — trying knowledge panels…" });
    } else {
      emit("status", { message: `Found ${businessNames.length} businesses — loading details…` });
    }

    const nameOccurrences = new Map<string, number>();

    for (let i = 0; i < businessNames.length && leadsEmitted < maxLeads; i++) {
      const name = businessNames[i];
      if (!name) continue;

      emit("status", { message: `[${i + 1}/${businessNames.length}] ${name}…` });

      const nameLower = name.toLowerCase();
      const occurrence = nameOccurrences.get(nameLower) ?? 0;
      nameOccurrences.set(nameLower, occurrence + 1);

      try {
        const safeText = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const heading = page.locator(
          '#search [role="heading"]:not(:has([role="heading"]))'
        ).filter({ hasText: new RegExp(safeText, "i") }).nth(occurrence);

        await heading.scrollIntoViewIfNeeded({ timeout: 4000 });
        await heading.click({ timeout: 5000, force: true });
      } catch {
        emit("status", { message: `Could not click result ${i + 1} — skipping` });
        continue;
      }

      await sleep(1800);

      const data: {
        popupName?: string;
        phone?: string; email?: string; website?: string;
        address?: string; city?: string; state?: string;
        hours?: string; rating?: string;
      } | null = await page.evaluate(function(args: [string, string]) {
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
        var utils = args[0];
        var businessName = args[1];
        eval(utils);

        var popup = document.querySelector("g-sticky-content-container") as HTMLElement | null;
        if (!popup || !(popup.innerText || "").trim()) return null;

        var nameLower = businessName.toLowerCase().trim();
        var container: HTMLElement = popup;
        var blocks = Array.prototype.slice.call(
          popup.querySelectorAll("block-component")
        ) as HTMLElement[];

        var findBlock = function(exact: boolean): HTMLElement | null {
          for (var b = 0; b < blocks.length; b++) {
            var els = Array.prototype.slice.call(
              blocks[b].querySelectorAll("h1, h2, h3, h4, [role='heading'], .kp-header")
            ) as HTMLElement[];
            for (var h = 0; h < els.length; h++) {
              var t = (els[h].innerText || "").trim().toLowerCase();
              if (!t || t.length < 2) continue;
              if (exact ? t === nameLower : (t.includes(nameLower) || nameLower.includes(t))) {
                return blocks[b];
              }
            }
          }
          return null;
        };

        var matched = findBlock(true) || findBlock(false);
        if (matched) container = matched;

        var fullText = container.innerText || "";
        var allLinks = Array.prototype.slice.call(
          container.querySelectorAll("a[href]")
        ) as HTMLAnchorElement[];

        var telLink = container.querySelector('a[href^="tel:"]') as HTMLAnchorElement | null;
        var phone: string | undefined =
          (telLink && telLink.href ? telLink.href.replace(/^tel:/i, "").trim() : undefined) || undefined;
        if (!phone) phone = parseField(fullText, "Phone");
        if (!phone) {
          var pm = fullText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
          if (pm) phone = pm[0].trim();
        }

        var mailtoLink = container.querySelector('a[href^="mailto:"]') as HTMLAnchorElement | null;
        var email: string | undefined =
          (mailtoLink && mailtoLink.href
            ? mailtoLink.href.replace(/^mailto:/i, "").split("?")[0].trim()
            : undefined) || undefined;

        var siteLink: HTMLAnchorElement | undefined = allLinks.find(function(a: HTMLAnchorElement) {
          var txt = ((a.innerText || (a as HTMLElement).textContent) || "").trim().toLowerCase();
          return txt === "website" && isExternal(a.href);
        });
        if (!siteLink) {
          var psVal = parseField(fullText, "Products and Services");
          if (psVal) {
            siteLink = allLinks.find(function(a: HTMLAnchorElement) {
              return isExternal(a.href) && (
                (a.innerText || "").trim() === psVal ||
                extractHost(a.href) === psVal!.replace(/^www\./, "")
              );
            });
          }
        }
        if (!siteLink) {
          siteLink = allLinks.find(function(a: HTMLAnchorElement) {
            if (!isExternal(a.href)) return false;
            var real = realUrl(a.href);
            return real.indexOf("/maps/") === -1 && real.indexOf("maps.google.") === -1;
          });
        }
        var website: string | undefined = siteLink ? extractHost(siteLink.href) : undefined;

        var address: string | undefined = parseField(fullText, "Address") || undefined;
        var addrParsed = parseAddr(address || "");
        var hours: string | undefined = parseField(fullText, "Hours") || undefined;

        var rating: string | undefined;
        var rEl = container.querySelector('[aria-label*="Rated"], [aria-label*="stars"]') as HTMLElement | null;
        if (rEl) {
          var rm = (rEl.getAttribute("aria-label") || "").match(/(\d+\.?\d*)/);
          if (rm) rating = rm[1];
        }

        return {
          popupName: "",
          phone, email, website, address,
          city: addrParsed.city, state: addrParsed.state,
          hours, rating,
        };
      }, [UTILS, name] as [string, string]);

      if (!data) {
        emit("status", { message: `No data found in popup for "${name}" — skipping` });
        continue;
      }

      emit("lead", {
        businessName: name,
        website:      data.website ?? "",
        phone:        data.phone,
        email:        data.email,
        address:      data.address,
        city:         data.city,
        state:        data.state,
        hours:        data.hours,
        snippet:      data.rating ? `${data.rating} ★` : undefined,
        sourceUrl:    queryOrUrl,
      });
      leadsEmitted++;

      await sleep(randInt(150, 300));
    }

    // Tier 2 — knowledge panels fallback
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
        var out: SerpLead[] = [];
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
          var links = Array.prototype.slice.call(container.querySelectorAll("a[href]")) as HTMLAnchorElement[];
          var siteA = links.find(function(a: HTMLAnchorElement) { return isExternal(a.href); });
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

    // Tier 3 — organic h3 fallback
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

    emit("status", { message: `Extracted ${leadsEmitted} result${leadsEmitted !== 1 ? "s" : ""} from Google` });
    return leadsEmitted;

  } catch (err) {
    emit("status", { message: `Extraction error: ${String(err)}` });
    return leadsEmitted;
  } finally {
    await page.close();
  }
}

// ─── Google Maps keyword scraper ──────────────────────────────────────────────
// 1. Opens google.com/maps/search/
// 2. Types keyword + location into the search input
// 3. Waits for div[role="feed"] (the results sidebar)
// 4. For each div[role="feed"] > div > div[role="article"]:
//    - reads business name from .fontHeadlineSmall
//    - clicks the article to open the detail popup
//    - reads address from [data-item-id="address"]
//    - reads phone from [data-tooltip="Copy phone number"]
//    - reads website from [data-tooltip="Open website"]
// 5. Presses Escape to close popup, scrolls feed, repeats

export async function scrapeGoogleMapsHeadless(
  keyword: string,
  location: string,
  maxLeads: number,
  onLog?: (msg: string) => void,
  onLead?: (lead: SerpLead, count: number) => Promise<void> | void,
  maxRuntimeMs?: number
): Promise<SerpLead[]> {
  const leads: SerpLead[] = [];
  const searchQuery = `${keyword} ${location}`;
  const startedAt = Date.now();

  let browser: import("playwright").Browser | null = null;
  let context: import("playwright").BrowserContext | null = null;

  try {
    const bc = await createBrowserContext();
    browser = bc.browser;
    context = bc.context;
    const page = await context.newPage();

    // ── Step 1: open Google Maps search page ──────────────────────────────────
    onLog?.("Opening Google Maps…");
    await page.goto("https://www.google.com/maps/search/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await sleep(1500);

    // Accept consent wall if present
    try {
      const consent = page.locator(
        'button:has-text("Accept all"), button:has-text("I agree"), button:has-text("Agree")'
      ).first();
      if (await consent.isVisible({ timeout: 3000 })) {
        await consent.click();
        await sleep(1000);
        onLog?.("Accepted consent dialog");
      }
    } catch { /* no consent wall */ }

    // ── Step 2: type the search query ─────────────────────────────────────────
    onLog?.(`Searching for "${searchQuery}"…`);
    const input = page.locator(
      'div[aria-label="Google Maps"] div[role="search"] form input'
    ).first();
    await input.click();
    await sleep(300);
    for (const char of searchQuery) {
      await page.keyboard.type(char, { delay: randInt(40, 90) });
    }
    await sleep(400);
    await page.keyboard.press("Enter");

    // ── Step 3: wait for the results feed ─────────────────────────────────────
    onLog?.("Waiting for results…");
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
    } catch {
      onLog?.("No results feed appeared — possible CAPTCHA or layout change");
      return leads;
    }
    await sleep(1000);

    // Track which articles we have already processed (by name)
    const seen = new Set<string>();
    let staleRounds = 0;

    // ── Step 4: scrape loop ────────────────────────────────────────────────────
    while (leads.length < maxLeads && staleRounds < 4) {
      // Stop early if we're approaching the caller's time limit so the
      // process route still has time to write the final "completed" status
      if (maxRuntimeMs && Date.now() - startedAt >= maxRuntimeMs) {
        onLog?.(`Time limit reached — saving ${leads.length} lead${leads.length !== 1 ? "s" : ""} collected so far`);
        break;
      }
      const childDivs = await page.locator('div[role="feed"] > div').all();
      let gotNewLead = false;

      for (const child of childDivs) {
        if (leads.length >= maxLeads) break;

        const article = child.locator('div[role="article"]').first();
        if (!(await article.isVisible().catch(() => false))) continue;

        // Business name from .fontHeadlineSmall inside the article
        const nameEl = article.locator(".fontHeadlineSmall").first();
        const businessName = (await nameEl.innerText({ timeout: 2000 }).catch(() => "")).trim();
        if (!businessName || seen.has(businessName)) continue;
        seen.add(businessName);

        onLog?.(`[${leads.length + 1}] ${businessName}`);

        // Read current panel heading so we can detect when it changes
        const h1Before = await page.evaluate(() => {
          const h1 = document.querySelector("h1");
          return (h1 as HTMLElement | null)?.innerText?.trim() ?? "";
        });

        // Click the article — force:true ensures the click fires even if the
        // element is partially covered by the map or a sticky header
        await article.click({ timeout: 5000, force: true }).catch(() => null);
        onLog?.(`Loading "${businessName}"…`);

        // ── Wait for the detail panel to open ─────────────────────────────────
        // We wait for the page's first <h1> to change from what it was before
        // clicking. This works whether Google Maps uses URL navigation or an
        // in-place slide-in panel, and avoids stale-data reads.
        try {
          await page.waitForFunction(
            (prev: string) => {
              const h1 = document.querySelector("h1");
              const text = (h1 as HTMLElement | null)?.innerText?.trim() ?? "";
              return text.length > 0 && text !== prev;
            },
            h1Before,
            { timeout: 8000 }
          );
        } catch {
          // h1 didn't change — still give the panel a moment to settle
          await sleep(2500);
        }

        // Small extra wait for lazy-loaded contact fields
        await sleep(500);

        // ── Step 5: extract contact data ───────────────────────────────────────
        const details = await page.evaluate(() => {
          function getText(sel: string): string {
            const el = document.querySelector(sel);
            return (el as HTMLElement | null)?.innerText?.trim() ?? "";
          }

          const address = getText('[data-item-id="address"]') || undefined;
          const phone   = getText('[data-tooltip="Copy phone number"]') || undefined;
          const website = getText('[data-tooltip="Open website"]') || undefined;

          let city: string | undefined, state: string | undefined;
          if (address) {
            const parts = address.split(",").map((s: string) => s.trim());
            for (let i = parts.length - 1; i >= 0; i--) {
              const m = parts[i].match(/^([A-Z]{2})(\s+\d{5})?$/);
              if (m) { state = m[1]; city = parts[i - 1]; break; }
            }
          }
          return { address, phone, website, city, state };
        });

        onLog?.(`✓ ${businessName}${details.phone ? ` · ${details.phone}` : ""}${details.address ? ` · ${details.address.split(",")[0]}` : " · no details"}`);

        const lead = {
          businessName,
          address: details.address,
          phone:   details.phone,
          website: details.website,
          city:    details.city,
          state:   details.state,
        };

        leads.push(lead);
        // Await the callback so each DB write completes before the next lead
        // is processed — prevents race conditions that corrupt pendingLeads
        await onLead?.(lead, leads.length);
        gotNewLead = true;

        // Close the detail panel and wait for the feed to be visible again
        await page.keyboard.press("Escape");
        await sleep(800);
        // If the feed is gone (full-page navigation happened), go back
        const feedVisible = await page.locator('div[role="feed"]').isVisible().catch(() => false);
        if (!feedVisible) {
          await page.goBack({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => null);
          await sleep(1000);
        }
      }

      if (!gotNewLead) {
        staleRounds++;
        onLog?.(`Scrolling for more… (${leads.length} leads so far)`);
        // Scroll the feed panel to reveal more results
        await page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) feed.scrollTop += 1400;
        });
        await sleep(1800);
      } else {
        staleRounds = 0;
      }
    }

    onLog?.(`Done — ${leads.length} lead${leads.length !== 1 ? "s" : ""} scraped`);
    await page.close();
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }

  return leads;
}
