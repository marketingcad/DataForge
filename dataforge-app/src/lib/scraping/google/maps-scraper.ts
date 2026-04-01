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
// Directory/aggregator domains that appear as "Website" links on Google Maps
// but are not the business's own website. Using them for dedup would cause
// massive false positives (all businesses linking to yelp.com share one "website").
const AGGREGATOR_HOSTS = new Set([
  "yelp.com","yellowpages.com","yp.com","bbb.org","angi.com","angieslist.com",
  "homeadvisor.com","houzz.com","thumbtack.com","tripadvisor.com","manta.com",
  "mapquest.com","whitepages.com","superpages.com","porch.com","bark.com",
  "homestars.com","checkatrade.com","trustpilot.com","birdeye.com","nextdoor.com",
  "citysearch.com","merchantcircle.com","bing.com","yahoo.com","apple.com",
]);

const UTILS = `
var SKIP_HOSTS = ["google.","goo.gl","youtube.","facebook.","twitter.","x.com",
                  "instagram.","linkedin.","pinterest.","tiktok.","snapchat.",
                  "yelp.","yellowpages.","yp.","bbb.org","angi.","angieslist.",
                  "homeadvisor.","houzz.","thumbtack.","tripadvisor.","manta.",
                  "mapquest.","whitepages.","superpages.","porch.","bark.",
                  "merchantcircle.","citysearch."];
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
// Two-phase approach for maximum speed + accuracy:
//
// Phase 1 — Fast name discovery:
//   Scroll the feed as fast as possible reading only .fontHeadlineSmall text.
//   No panel clicks. Collect all business names visible in the feed.
//   Compare against skipNames cache → build toScrape set (only new businesses).
//
// Phase 2 — Targeted extraction:
//   Scroll back to top, iterate the feed again.
//   Skip articles whose name is already in DB (not in toScrape).
//   Click + extract contact details only for toScrape businesses.
//
// Result: Phase 1 takes only a few seconds (no network waits), Phase 2 only
// opens panels for businesses that are actually new — no wasted clicks.

export async function scrapeGoogleMapsHeadless(
  keyword: string,
  location: string,
  maxLeads: number,
  onLog?: (msg: string) => void,
  onLead?: (lead: SerpLead, count: number) => Promise<boolean | void> | boolean | void,
  maxRuntimeMs?: number,
  isDuplicate?: (lead: SerpLead) => boolean,
  skipNames?: Set<string>
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
    page.setDefaultTimeout(15000);

    // Navigate directly to the Maps search URL
    const searchUrl =
      "https://www.google.com/maps/search/" +
      encodeURIComponent(searchQuery).replace(/%20/g, "+") + "/";
    onLog?.(`Opening Google Maps search…`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(800);

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

    // CAPTCHA detector
    const hasCaptcha = async (): Promise<boolean> => {
      const url = page.url();
      if (url.includes("/sorry/") || url.includes("google.com/sorry")) return true;
      return page.evaluate(() => {
        const body = (document.body?.innerText ?? "").toLowerCase();
        return body.includes("unusual traffic") ||
               body.includes("captcha") ||
               !!document.querySelector('iframe[src*="recaptcha"], iframe[title*="reCAPTCHA"]');
      }).catch(() => false);
    };

    // Wait for the results feed
    onLog?.("Waiting for results…");
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
    } catch {
      if (await hasCaptcha()) {
        onLog?.("CAPTCHA detected — stopping");
        return leads;
      }
      onLog?.("No results feed appeared — possible CAPTCHA or layout change");
      return leads;
    }
    await sleep(600);

    // ── Phase 1: Fast name discovery ───────────────────────────────────────────
    // Read all visible names in one page.evaluate() per scroll — single browser
    // round-trip instead of one Playwright locator call per article.
    onLog?.("Phase 1: scanning all results…");

    const allDiscoveredNames: string[] = [];
    const discoveredSet = new Set<string>();
    // Collect at most 2× maxLeads names — enough buffer for ~50% duplicates.
    const DISCOVERY_TARGET = Math.max(maxLeads * 2, maxLeads + 20);
    let phase1Stale = 0;

    while (allDiscoveredNames.length < DISCOVERY_TARGET && phase1Stale < 5) {
      // Read every visible business name in the feed in one JS evaluation.
      const visibleNames: string[] = await page.evaluate(() => {
        const articles = document.querySelectorAll(
          'div[role="feed"] div[role="article"]'
        );
        const names: string[] = [];
        for (let i = 0; i < articles.length; i++) {
          const el = articles[i].querySelector(".fontHeadlineSmall") as HTMLElement | null;
          const text = el?.innerText?.trim();
          if (text) names.push(text);
        }
        return names;
      });

      let foundNew = false;
      for (const name of visibleNames) {
        if (discoveredSet.has(name)) continue;
        discoveredSet.add(name);
        allDiscoveredNames.push(name);
        foundNew = true;
      }

      if (!foundNew) {
        phase1Stale++;
      } else {
        phase1Stale = 0;
      }

      // Scroll fast — no waiting for network, just DOM reads
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollTop += 1400;
      });
      await sleep(300);
    }

    // Build the target set: names not already in the DB
    const toScrape = new Set<string>(
      allDiscoveredNames.filter(name => !skipNames?.has(name.toLowerCase().trim()))
    );
    const skippedCount = allDiscoveredNames.length - toScrape.size;
    onLog?.(
      `Phase 1 done: ${allDiscoveredNames.length} found, ` +
      `${skippedCount} already in DB → ${toScrape.size} to scrape`
    );

    if (toScrape.size === 0) {
      onLog?.("All discovered businesses already saved — done");
      return leads;
    }

    // ── Phase 2: Targeted extraction ──────────────────────────────────────────
    // Scroll back to top, then click only businesses in toScrape.
    await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (feed) feed.scrollTop = 0;
    });
    await sleep(600);

    onLog?.(`Phase 2: extracting details for up to ${Math.min(maxLeads, toScrape.size)} businesses…`);

    const seen = new Set<string>(); // processed in Phase 2
    let staleRounds = 0;

    // Phase 2: stop when we've collected maxLeads non-duplicate leads.
    while (leads.length < maxLeads && staleRounds < 4) {
      if (maxRuntimeMs && Date.now() - startedAt >= maxRuntimeMs) {
        onLog?.(`Time limit reached — saving ${leads.length} lead${leads.length !== 1 ? "s" : ""} collected so far`);
        break;
      }

      if (await hasCaptcha()) {
        onLog?.(`CAPTCHA detected — stopping and saving ${leads.length} lead${leads.length !== 1 ? "s" : ""} collected so far`);
        break;
      }

      const childDivs = await page.locator('div[role="feed"] > div').all();
      let gotNewArticle = false;

      for (const child of childDivs) {
        if (leads.length >= maxLeads) break;

        const article = child.locator('div[role="article"]').first();
        if (!(await article.isVisible().catch(() => false))) continue;

        const nameEl = article.locator(".fontHeadlineSmall").first();
        const businessName = (await nameEl.innerText({ timeout: 2000 }).catch(() => "")).trim();
        if (!businessName || seen.has(businessName)) continue;
        seen.add(businessName);
        gotNewArticle = true;

        // Skip if already in DB: either filtered by Phase 1 or a late-discovered name
        const isKnown = !toScrape.has(businessName) &&
          (skipNames?.has(businessName.toLowerCase().trim()) ?? false);
        if (isKnown) {
          onLog?.(`"${businessName}" already in DB — skipping`);
          continue;
        }

        // Also skip names not in toScrape that Phase 1 didn't see — treat as new
        // (falls through to extraction below)

        // Extract website from the card's a[data-value="Website"] href (already in the feed listing)
        let cardWebsite: string | undefined;
        try {
          const websiteHref = await article.locator('a[data-value="Website"]').first().getAttribute('href', { timeout: 1000 });
          if (websiteHref) {
            const u = new URL(websiteHref);
            const host = u.hostname.replace(/^www\./, "");
            const isAggregator = AGGREGATOR_HOSTS.has(host) ||
              [...AGGREGATOR_HOSTS].some(d => host.endsWith("." + d));
            if (!u.hostname.includes("google") && !isAggregator) {
              cardWebsite = host;
            }
          }
        } catch { /* no website on this card */ }

        onLog?.(`Scraping ${leads.length + 1}/${Math.min(maxLeads, toScrape.size)}: "${businessName}"…`);

        const LEAD_TIMEOUT_MS = 60_000;
        let leadTimedOut = false;

        await Promise.race([
          (async () => {
            await article.click({ timeout: 5000, force: true }).catch(() => null);

            // Wait for the detail panel identified by aria-label=businessName (outside
            // the feed) AND for at least one data field to have loaded inside it.
            // Single scoped check — prevents reading stale data from a prior panel.
            await page.waitForFunction((bName: string) => {
              const feed = document.querySelector('div[role="feed"]');
              const els = document.querySelectorAll("[aria-label]");
              for (let i = 0; i < els.length; i++) {
                const el = els[i];
                if (el.getAttribute("aria-label") !== bName) continue;
                if (feed && feed.contains(el)) continue;
                return !!(
                  el.querySelector('[data-item-id="address"]') ||
                  el.querySelector('[data-tooltip="Copy phone number"]')
                );
              }
              return false;
            }, businessName, { timeout: 6000 }).catch(() => null);

            if (leadTimedOut) return;

            if (await hasCaptcha()) {
              onLog?.(`CAPTCHA detected — stopping and saving ${leads.length} lead${leads.length !== 1 ? "s" : ""} collected so far`);
              leads.push({ businessName: "\x00CAPTCHA\x00" });
              return;
            }

            if (leadTimedOut) return;

            const details = await page.evaluate((bName: string) => {
              const feed = document.querySelector('div[role="feed"]');

              // Scope ALL extraction to the panel with aria-label=businessName outside
              // the feed. This guarantees we never mix data between businesses.
              let panel: HTMLElement | null = null;
              const els = document.querySelectorAll("[aria-label]");
              for (let i = 0; i < els.length; i++) {
                const el = els[i] as HTMLElement;
                if (el.getAttribute("aria-label") !== bName) continue;
                if (feed && feed.contains(el)) continue;
                panel = el;
                break;
              }
              if (!panel) return null;

              // Address
              const addrEl = panel.querySelector('[data-item-id="address"]');
              const address = (addrEl as HTMLElement | null)?.innerText
                ?.replace(/\n/g, " ").trim() || undefined;

              // Phone
              const phoneEl = panel.querySelector('[data-tooltip="Copy phone number"]');
              const phone = (phoneEl as HTMLElement | null)?.innerText
                ?.replace(/\n/g, " ").trim() || undefined;

              // Website
              let website: string | undefined;
              const siteEl = panel.querySelector('[data-tooltip="Open website"]') as HTMLAnchorElement | null;
              if (siteEl?.href) {
                try {
                  const u = new URL(siteEl.href);
                  const host = u.hostname.replace(/^www\./, "");
                  const skipHosts = ["google.", "goo.gl", "youtube.", "facebook.", "instagram.", "twitter.", "x.com"];
                  if (!skipHosts.some(h => host.includes(h))) website = host;
                } catch { /* ignore */ }
              }

              let city: string | undefined, state: string | undefined;
              if (address) {
                const parts = address.split(",").map((s: string) => s.trim());
                for (let i = parts.length - 1; i >= 0; i--) {
                  const m = parts[i].match(/^([A-Z]{2})(\s+\d{5})?$/);
                  if (m) { state = m[1]; city = parts[i - 1]; break; }
                }
              }

              return { address, phone, city, state, website };
            }, businessName).catch(() => null);

            if (leadTimedOut || !details) return;

            const lead: SerpLead = {
              businessName,
              address: details.address,
              phone:   details.phone,
              website: details.website ?? cardWebsite,
              city:    details.city,
              state:   details.state,
            };

            if (isDuplicate?.(lead)) {
              onLog?.(`Already in database (phone/website match) — skipping`);
            } else {
              leads.push(lead);
              await onLead?.(lead, leads.length);
              onLog?.(`Collected ${leads.length} — ${[details.phone && "phone", details.address && "address", (details.website ?? cardWebsite) && "website"].filter(Boolean).join(", ") || "name only"}`);
            }

            // Close the detail panel
            await page.keyboard.press("Escape").catch(() => null);
            const feedVisible = await page.locator('div[role="feed"]')
              .waitFor({ state: "visible", timeout: 1500 })
              .then(() => true).catch(() => false);
            if (!feedVisible) {
              await page.goBack({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => null);
              await sleep(200);
              if (await hasCaptcha()) {
                leads.push({ businessName: "\x00CAPTCHA\x00" });
              }
            }
          })(),
          sleep(LEAD_TIMEOUT_MS).then(() => { leadTimedOut = true; }),
        ]);

        if (leadTimedOut) {
          onLog?.(`Lead took over 1 minute — skipping`);
          continue;
        }

        if (leads[leads.length - 1]?.businessName === "\x00CAPTCHA\x00") {
          leads.pop();
          return leads;
        }
      }

      if (!gotNewArticle) {
        staleRounds++;
        onLog?.(`Scrolling for more results…`);
        await page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) feed.scrollTop += 1400;
        });
        await sleep(1200);
      } else {
        staleRounds = 0;
      }
    }

    onLog?.(`Done — saving ${leads.length} lead${leads.length !== 1 ? "s" : ""}…`);
    await page.close();
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }

  return leads;
}
