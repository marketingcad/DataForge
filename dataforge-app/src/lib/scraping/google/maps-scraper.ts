import {
  sleep, randInt,
  createBrowserContext, createScraperContext,
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
    await sleep(randInt(300, 550));

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

// Approximate coordinates for US states and major cities so we can set the
// browser geolocation to match the search location. Google Maps uses geolocation
// to bias results — without this, it falls back to the server's IP (e.g. Philippines).
const LOCATION_COORDS: Record<string, { latitude: number; longitude: number }> = {
  "alabama": { latitude: 32.806671, longitude: -86.791130 },
  "alaska": { latitude: 61.370716, longitude: -152.404419 },
  "arizona": { latitude: 33.729759, longitude: -111.431221 },
  "arkansas": { latitude: 34.969704, longitude: -92.373123 },
  "california": { latitude: 36.116203, longitude: -119.681564 },
  "colorado": { latitude: 39.059811, longitude: -105.311104 },
  "connecticut": { latitude: 41.597782, longitude: -72.755371 },
  "delaware": { latitude: 39.318523, longitude: -75.507141 },
  "florida": { latitude: 27.766279, longitude: -81.686783 },
  "georgia": { latitude: 33.040619, longitude: -83.643074 },
  "hawaii": { latitude: 21.094318, longitude: -157.498337 },
  "idaho": { latitude: 44.240459, longitude: -114.478828 },
  "illinois": { latitude: 40.349457, longitude: -88.986137 },
  "indiana": { latitude: 39.849426, longitude: -86.258278 },
  "iowa": { latitude: 42.011539, longitude: -93.210526 },
  "kansas": { latitude: 38.526600, longitude: -96.726486 },
  "kentucky": { latitude: 37.668140, longitude: -84.670067 },
  "louisiana": { latitude: 31.169960, longitude: -91.867805 },
  "maine": { latitude: 44.693947, longitude: -69.381927 },
  "maryland": { latitude: 39.063946, longitude: -76.802101 },
  "massachusetts": { latitude: 42.230171, longitude: -71.530106 },
  "michigan": { latitude: 43.326618, longitude: -84.536095 },
  "minnesota": { latitude: 45.694454, longitude: -93.900192 },
  "mississippi": { latitude: 32.741646, longitude: -89.678696 },
  "missouri": { latitude: 38.456085, longitude: -92.288368 },
  "montana": { latitude: 46.921925, longitude: -110.454353 },
  "nebraska": { latitude: 41.125370, longitude: -98.268082 },
  "nevada": { latitude: 38.313515, longitude: -117.055374 },
  "new hampshire": { latitude: 43.452492, longitude: -71.563896 },
  "new jersey": { latitude: 40.298904, longitude: -74.521011 },
  "new mexico": { latitude: 34.840515, longitude: -106.248482 },
  "new york": { latitude: 42.165726, longitude: -74.948051 },
  "north carolina": { latitude: 35.630066, longitude: -79.806419 },
  "north dakota": { latitude: 47.528912, longitude: -99.784012 },
  "ohio": { latitude: 40.388783, longitude: -82.764915 },
  "oklahoma": { latitude: 35.565342, longitude: -96.928917 },
  "oregon": { latitude: 44.572021, longitude: -122.070938 },
  "pennsylvania": { latitude: 40.590752, longitude: -77.209755 },
  "rhode island": { latitude: 41.680893, longitude: -71.511780 },
  "south carolina": { latitude: 33.856892, longitude: -80.945007 },
  "south dakota": { latitude: 44.299782, longitude: -99.438828 },
  "tennessee": { latitude: 35.747845, longitude: -86.692345 },
  "texas": { latitude: 31.054487, longitude: -97.563461 },
  "utah": { latitude: 40.150032, longitude: -111.862434 },
  "vermont": { latitude: 44.045876, longitude: -72.710686 },
  "virginia": { latitude: 37.769337, longitude: -78.169968 },
  "washington": { latitude: 47.400902, longitude: -121.490494 },
  "west virginia": { latitude: 38.491226, longitude: -80.954453 },
  "wisconsin": { latitude: 44.268543, longitude: -89.616508 },
  "wyoming": { latitude: 42.755966, longitude: -107.302490 },
  // Major cities
  "new york city": { latitude: 40.712776, longitude: -74.005974 },
  "los angeles": { latitude: 34.052235, longitude: -118.243683 },
  "chicago": { latitude: 41.878113, longitude: -87.629799 },
  "houston": { latitude: 29.760427, longitude: -95.369804 },
  "phoenix": { latitude: 33.448376, longitude: -112.074036 },
  "philadelphia": { latitude: 39.952583, longitude: -75.165222 },
  "san antonio": { latitude: 29.424122, longitude: -98.493629 },
  "san diego": { latitude: 32.715736, longitude: -117.161087 },
  "dallas": { latitude: 32.776664, longitude: -96.796988 },
  "miami": { latitude: 25.761681, longitude: -80.191788 },
  "atlanta": { latitude: 33.748997, longitude: -84.387985 },
  "seattle": { latitude: 47.606209, longitude: -122.332071 },
  "denver": { latitude: 39.739235, longitude: -104.984862 },
  "las vegas": { latitude: 36.174969, longitude: -115.137341 },
  "boston": { latitude: 42.360082, longitude: -71.058880 },
};

function getApproxCoords(location: string): { latitude: number; longitude: number } {
  const key = location.trim().toLowerCase();
  // Match most-specific first (longer names win over shorter country names)
  const sorted = Object.entries(LOCATION_COORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [name, coords] of sorted) {
    if (key.includes(name)) return coords;
  }
  // Default to center of continental US
  return { latitude: 39.8283, longitude: -98.5795 };
}

export async function scrapeGoogleMapsHeadless(
  keyword: string,
  location: string,
  maxLeads: number,
  onLog?: (msg: string) => void,
  onLead?: (lead: SerpLead, count: number) => Promise<boolean | void> | boolean | void,
  maxRuntimeMs?: number,
  isDuplicate?: (lead: SerpLead) => boolean,
  skipNames?: Set<string>,
  isCancelled?: () => boolean | Promise<boolean>,
  overrideCoords?: { latitude: number; longitude: number },
  // When provided, this scrape runs in its OWN context inside the shared browser
  // (one tab-set per keyword) instead of launching a dedicated browser. The
  // caller owns the browser lifecycle; we only close our context here.
  sharedBrowser?: import("playwright-core").Browser,
  // Boost mode — cut the human-like delays for a faster scrape (higher block risk).
  boost?: boolean
): Promise<SerpLead[]> {
  const leads: SerpLead[] = [];
  // Scales every pacing delay. Boost ≈ 40% of normal; even without boost we run
  // at ~60% of the old delays to cut function-time/cost. Floors keep a little
  // jitter so it isn't perfectly robotic.
  const paced = (ms: number) =>
    boost ? Math.max(60, Math.round(ms * 0.4)) : Math.max(120, Math.round(ms * 0.6));
  // Shuffle the 3 semantic parts (main keyword, extras, location) so the query
  // order varies each run — reduces pattern detection by Google Maps.
  const searchQuery = location.trim()
    ? [keyword, location.trim()].sort(() => Math.random() - 0.5).join(" ")
    : keyword;
  const startedAt = Date.now();

  let browser: import("playwright-core").Browser | null = null;
  let context: import("playwright").BrowserContext | null = null;
  // Own the browser only when we launched it. A shared browser is closed by the caller.
  const ownsBrowser = !sharedBrowser;

  try {
    if (sharedBrowser) {
      browser = sharedBrowser;
      context = await createScraperContext(sharedBrowser) as import("playwright").BrowserContext;
    } else {
      const bc = await createBrowserContext();
      browser = bc.browser;
      context = bc.context as import("playwright").BrowserContext;
    }

    // Pin the browser's geolocation to the searched location so Google Maps
    // doesn't bias results toward the server's physical IP location.
    const coords = overrideCoords ?? getApproxCoords(location);
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(coords);
    onLog?.(`Geolocation set to ${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)} (near "${location}")`);

    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    // Embed coordinates in the URL (@lat,lng,zoom) so Google Maps centers on the
    // target location regardless of the server's IP geolocation.
    const searchUrl =
      "https://www.google.com/maps/search/" +
      encodeURIComponent(searchQuery).replace(/%20/g, "+") +
      `/@${coords.latitude},${coords.longitude},11z/`;
    onLog?.(`Searching Google Maps for: "${searchQuery}" (pinned to ${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)})`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(paced(800));

    // Log the final URL in case Google redirected (useful for debugging location issues)
    const finalUrl = page.url();
    if (!finalUrl.includes(encodeURIComponent(searchQuery).replace(/%20/g, "+"))) {
      onLog?.(`Note: Google redirected to ${finalUrl}`);
    }

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
    await sleep(randInt(paced(300), paced(550)));

    // ── Phase 1: Fast name discovery ───────────────────────────────────────────
    // Read all visible names in one page.evaluate() per scroll — single browser
    // round-trip instead of one Playwright locator call per article.
    onLog?.("Phase 1: scanning all results…");

    const allDiscoveredNames: string[] = [];
    const discoveredSet = new Set<string>();
    // Collect at most 1.2× maxLeads names — small buffer for ~17% duplicates.
    // Phase 1 ends sooner; Phase 2 still scrolls and picks up late-discovered
    // names, so a tight buffer here mostly just saves discovery time.
    const DISCOVERY_TARGET = Math.max(Math.ceil(maxLeads * 1.1), maxLeads + 6);
    // Phase 1 cap starts NOW (not from scraper start) so browser launch time
    // doesn't eat into the discovery window.
    const PHASE1_MAX_MS = 35_000; // phase 1 hard cap: 35 s
    const phase1StartedAt = Date.now();
    let phase1Stale = 0;

    while (allDiscoveredNames.length < DISCOVERY_TARGET && phase1Stale < 5) {
      if (await isCancelled?.()) {
        onLog?.("Cancelled — stopping");
        return leads;
      }
      if (Date.now() - phase1StartedAt >= PHASE1_MAX_MS) {
        onLog?.(`Phase 1 time limit reached — continuing with ${allDiscoveredNames.length} names`);
        break;
      }
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

      // Scroll and wait — jittered ~350-550 ms gives Google Maps enough time to
      // lazy-load the next batch while keeping timing human-like (not a fixed
      // robotic interval). Faster on average than the old flat 700 ms.
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollTop += 1400;
      });
      await sleep(randInt(paced(350), paced(550)));
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
    await sleep(randInt(paced(300), paced(550)));

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

        // Check cancellation + time limit inside the inner loop so we stop
        // promptly even when iterating hundreds of articles without emitting leads.
        if (await isCancelled?.()) {
          onLog?.("Cancelled — stopping");
          return leads;
        }
        if (maxRuntimeMs && Date.now() - startedAt >= maxRuntimeMs) {
          onLog?.(`Time limit reached — saving ${leads.length} lead${leads.length !== 1 ? "s" : ""} collected so far`);
          return leads;
        }

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

        const LEAD_TIMEOUT_MS = 12_000;
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
            }, businessName, { timeout: 4000 }).catch(() => null);

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
                ?.replace(/\n/g, " ")
                .replace(/^[^0-9a-zA-Z]+/, "") // strip leading icon/symbol characters
                .trim() || undefined;

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
          onLog?.(`Lead took too long (>12s) — skipping`);
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
        await sleep(randInt(paced(550), paced(850)));
      } else {
        staleRounds = 0;
      }
    }

    onLog?.(`Done — saving ${leads.length} lead${leads.length !== 1 ? "s" : ""}…`);
    await page.close();
  } finally {
    // Always close our own context; only close the browser if we launched it.
    await context?.close().catch(() => {});
    if (ownsBrowser) await browser?.close().catch(() => {});
  }

  return leads;
}
