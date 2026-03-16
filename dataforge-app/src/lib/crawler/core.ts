/**
 * Shared crawler core — browser, rate-limiting, HTML extraction.
 * Used by both /api/scraping/stream and /api/scraping/google-stream.
 */

import * as cheerio from "cheerio";
import { normalizeWebsite } from "@/lib/utils/normalize";

// ─── Constants ───────────────────────────────────────────────────────────────

export const CRAWLER_UA  = "DataForgeCrawler/1.0 (contact: admin@dataforge.app)";
export const MIN_DELAY_MS = 2000;
export const MAX_RETRIES  = 2;

export const EMAIL_RE   = /[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/g;
export const PHONE_RE   = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
export const ADDRESS_RE = /\d{1,5}\s[\w\s.]{3,40},\s[\w\s]{2,30},?\s[A-Z]{2}\s\d{5}/g;
export const FAKE_EMAILS = ["example.", "@sentry", "@w3.org", "noreply@", "no-reply@", "test@", "user@"];
export const SKIP_EXT   = /\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|woff|woff2|ttf|ico|xml|json)(\?|$)/i;
export const SKIP_HREF  = /^(mailto:|tel:|javascript:|#)/i;
export const PAGINATION_RE = /[?&](page|p|pg|offset|start|from|skip|num)=\d+/i;

// ─── Types ────────────────────────────────────────────────────────────────────

export type FetchResult =
  | { ok: true; html: string }
  | { ok: false; reason: "blocked" | "rate_limited" | "not_found" | "error"; retryAfterMs?: number; status?: number };

export interface LeadData {
  businessName: string;
  contactPerson?: string;
  address?: string;
  city?: string;
  state?: string;
  website: string;
  phone?: string;
  email?: string;
  sourceUrl: string;
}

export interface Contact {
  businessName?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function jitter(ms: number) {
  return sleep(ms + randInt(0, Math.floor(ms * 0.4)));
}

export function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

export function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

export class RateLimiter {
  private lastRequest = 0;
  constructor(private delayMs: number) {}

  async wait() {
    const elapsed = Date.now() - this.lastRequest;
    if (this.lastRequest > 0 && elapsed < this.delayMs) {
      await sleep(this.delayMs - elapsed);
    }
    this.lastRequest = Date.now();
  }
}

// ─── Block detection ──────────────────────────────────────────────────────────

export function detectBlock(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    (lower.includes("cloudflare") && (lower.includes("ray id") || lower.includes("challenge") || lower.includes("captcha"))) ||
    lower.includes("access denied") ||
    lower.includes("403 forbidden") ||
    lower.includes("bot detection") ||
    (lower.includes("captcha") && html.length < 5000)
  );
}

// ─── Stealth browser ──────────────────────────────────────────────────────────

const STEALTH_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver',          { get: () => undefined });
  Object.defineProperty(navigator, 'plugins',            { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, 'languages',          { get: () => ['en-US', 'en'] });
  Object.defineProperty(navigator, 'platform',           { get: () => 'Win32' });
  Object.defineProperty(navigator, 'hardwareConcurrency',{ get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory',       { get: () => 8 });
  window.chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}), app: {} };
`;

export async function createBrowserContext() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1920,1080",
    ],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    timezoneId: "America/New_York",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  await context.addInitScript(STEALTH_SCRIPT);
  return { browser, context };
}

// ─── Human-like page interaction ──────────────────────────────────────────────

export async function humanScroll(page: import("playwright").Page) {
  const scrollHeight: number = await page.evaluate(() => document.body.scrollHeight);
  const viewHeight:   number = await page.evaluate(() => window.innerHeight);
  if (scrollHeight <= viewHeight) return;

  let y = 0;
  while (y < scrollHeight * 0.75) {
    y = Math.min(y + randInt(250, 600), scrollHeight);
    await page.evaluate((top: number) => window.scrollTo({ top, behavior: "smooth" }), y);
    await sleep(randInt(300, 700));
  }
  if (Math.random() > 0.6) {
    await page.evaluate((top: number) => window.scrollTo({ top, behavior: "smooth" }), randInt(0, Math.floor(y * 0.3)));
    await sleep(randInt(200, 500));
  }
}

export async function humanMouseMove(page: import("playwright").Page) {
  const vp = page.viewportSize() ?? { width: 1920, height: 1080 };
  for (let i = 0; i < randInt(2, 4); i++) {
    await page.mouse.move(randInt(100, vp.width - 100), randInt(100, vp.height - 100));
    await sleep(randInt(80, 220));
  }
}

// ─── Page fetcher ─────────────────────────────────────────────────────────────

export async function fetchPage(
  url: string,
  context: import("playwright").BrowserContext,
  retries = MAX_RETRIES
): Promise<FetchResult> {
  const page = await context.newPage();
  try {
    await sleep(randInt(600, 2000)); // pre-nav pause

    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    if (!response) return { ok: false, reason: "error" };

    const status = response.status();
    if (status === 404)            return { ok: false, reason: "not_found", status };
    if (status === 403 || status === 401) return { ok: false, reason: "blocked", status };
    if (status === 429 || status === 503) {
      const ra = parseInt(response.headers()["retry-after"] ?? "0", 10);
      return { ok: false, reason: "rate_limited", status, retryAfterMs: (ra > 0 ? ra : 30) * 1000 };
    }

    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await humanMouseMove(page);
    await sleep(randInt(400, 900));
    await humanScroll(page);
    await sleep(randInt(500, 1200));

    const html = await page.content();
    if (detectBlock(html)) return { ok: false, reason: "blocked", status };

    return { ok: true, html };
  } catch {
    return { ok: false, reason: "error" };
  } finally {
    await page.close();
  }

  void retries; // consumed by caller retry loop
}

// ─── Link extraction ──────────────────────────────────────────────────────────

export function extractLinks(html: string, origin: string, domain: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (SKIP_HREF.test(href) || SKIP_EXT.test(href) || PAGINATION_RE.test(href)) return;
    try {
      const u = new URL(href, origin);
      u.hash = "";
      const d = u.hostname.replace(/^www\./, "");
      if (d === domain) links.push(u.toString().replace(/\/$/, ""));
    } catch { /* skip */ }
  });
  return [...new Set(links)];
}

// ─── Name validator ───────────────────────────────────────────────────────────

const NON_NAME_WORDS = new Set([
  "Street","Avenue","Boulevard","Drive","Road","Lane","Court","Place","Suite",
  "Floor","Building","Corp","Inc","LLC","Ltd","LLP","Co","Company","Group",
  "The","And","For","With","From","This","That","Your","Our","New","Old",
  "North","South","East","West","Central","Real","Estate","Realty","Properties",
  "Services","Solutions","Systems","Technologies","Management","Associates",
  "View","Home","Homes","House","Office","Center","Centre","Park","Plaza",
  "Contact","About","Team","Staff","Join","Meet","Call","Email","Phone",
  "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday",
  "January","February","March","April","June","July","August","September",
  "October","November","December",
]);

export function isLikelyPersonName(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 4 || s.length > 60) return false;
  const words = s.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  const wordOk = (w: string) => /^[A-Z][a-zA-Z''\-]{1,19}\.?$/.test(w);
  if (!words.every(wordOk)) return false;
  if (words.some((w) => NON_NAME_WORDS.has(w))) return false;
  return true;
}

// ─── Contact extraction ───────────────────────────────────────────────────────

export function extractContacts(html: string, _url: string): Contact[] {
  const $ = cheerio.load(html);
  const bodyText = $("body").text();
  const contacts: Contact[] = [];

  // 1. JSON-LD
  const BUSINESS_TYPES = new Set([
    "LocalBusiness","Restaurant","FoodEstablishment","Store","Hotel","Dentist",
    "Physician","LegalService","FinancialService","RealEstateAgent","AutoDealer",
    "Organization","Corporation","ProfessionalService","HomeAndConstructionBusiness",
  ]);
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "");
      const items: unknown[] = Array.isArray(data) ? data.flat(3) : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const type = String(o["@type"] ?? "");
        if (["Person", "Employee", "ContactPoint"].includes(type)) {
          contacts.push({
            name:  typeof o.name      === "string" ? o.name      : undefined,
            email: typeof o.email     === "string" ? o.email     : undefined,
            phone: typeof o.telephone === "string" ? o.telephone : undefined,
          });
        } else if (BUSINESS_TYPES.has(type)) {
          const addr = o.address as Record<string, string> | undefined;
          contacts.push({
            businessName: typeof o.name      === "string" ? o.name      : undefined,
            email:        typeof o.email     === "string" ? o.email     : undefined,
            phone:        typeof o.telephone === "string" ? o.telephone : undefined,
            address: addr?.streetAddress,
            city:    addr?.addressLocality,
            state:   addr?.addressRegion,
          });
        }
      }
    } catch { /* bad JSON */ }
  });

  // 2. Schema.org microdata
  const BTYPE_SEL = [
    "[itemtype*='LocalBusiness']","[itemtype*='Restaurant']","[itemtype*='Store']",
    "[itemtype*='Organization']","[itemtype*='Person']","[itemtype*='FoodEstablishment']",
  ].join(",");
  $(BTYPE_SEL).each((_, el) => {
    const $el = $(el);
    const isPersonType = ($el.attr("itemtype") ?? "").includes("Person");
    const nameEl = $el.find("[itemprop='name']").first().text().trim();
    const phone  = $el.find("[itemprop='telephone']").first().text().trim();
    const email  = $el.find("[itemprop='email']").first().text().trim();
    const street = $el.find("[itemprop='streetAddress']").first().text().trim();
    const city   = $el.find("[itemprop='addressLocality']").first().text().trim();
    const state  = $el.find("[itemprop='addressRegion']").first().text().trim();
    if (!nameEl && !phone && !email) return;
    contacts.push({
      businessName: !isPersonType ? nameEl || undefined : undefined,
      name:  isPersonType && isLikelyPersonName(nameEl) ? nameEl : undefined,
      phone: phone  || undefined,
      email: email  || undefined,
      address: street || undefined,
      city:    city   || undefined,
      state:   state  || undefined,
    });
  });

  // 3. Listing / profile card patterns
  const CARD_SEL = [
    ".result","li.result","div.result",".v-card",".business-listing",
    "[class*='result-']","[class*='listing-item']","[class*='biz-listing']",
    "[class*='search-result']","[class*='business-card']","[class*='company-card']",
    "[class*='agent']","[class*='staff']","[class*='member']","[class*='profile']",
    "[class*='broker']","[class*='realtor']","[class*='person']","[class*='employee']",
    "[class*='team-member']","[class*='expert']","[class*='advisor']","[class*='bio']",
    "article","li.item","div.item","[class*='contact-card']",
  ].join(",");
  $(CARD_SEL).each((_, card) => {
    const $card    = $(card);
    const cardText = $card.text();
    const cardEmails = (cardText.match(EMAIL_RE) ?? []).filter(
      (e) => !FAKE_EMAILS.some((f) => e.toLowerCase().includes(f))
    );
    const cardPhones = cardText.match(PHONE_RE) ?? [];
    if (!cardEmails.length && !cardPhones.length) return;

    let name: string | undefined, businessName: string | undefined;
    const headSel = "h1,h2,h3,h4,h5,.business-name,.n,[class*='name'],[class*='title'],[itemprop='name'],strong";
    $card.find(headSel).each((_, el) => {
      if (name || businessName) return false;
      const t = $(el).text().trim();
      if (!t || t.length > 120) return;
      if (isLikelyPersonName(t)) name = t;
      else if (t.length >= 2 && !/^\d/.test(t)) businessName = t;
    });

    let address: string | undefined, city: string | undefined, state: string | undefined;
    const adrEl = $card.find(".adr,[itemprop='address'],.address,[class*='address']").first();
    if (adrEl.length) {
      address = adrEl.find(".street-address,[itemprop='streetAddress']").text().trim() || undefined;
      city    = adrEl.find(".locality,[itemprop='addressLocality']").text().trim()     || undefined;
      state   = adrEl.find(".region,[itemprop='addressRegion']").text().trim()         || undefined;
    }
    if (!address) {
      const m = cardText.match(ADDRESS_RE);
      if (m) {
        address = m[0];
        const p = address.split(",").map(s => s.trim());
        city  = p[p.length - 2];
        state = (p[p.length - 1] ?? "").split(" ")[0];
      }
    }
    contacts.push({ businessName, name, email: cardEmails[0], phone: cardPhones[0], address, city, state });
  });

  // 4. Proximity scan: names near phone/email
  const NAME_PAT = /\b([A-Z][a-z''\-]{1,19}(?:\s[A-Z][a-z''\-]{1,19}){1,3})\b/g;
  for (const pm of bodyText.matchAll(new RegExp(PHONE_RE.source, "g"))) {
    const idx     = pm.index ?? 0;
    const snippet = bodyText.slice(Math.max(0, idx - 120), idx + 40);
    for (const c of snippet.match(NAME_PAT) ?? []) {
      if (isLikelyPersonName(c)) { contacts.push({ name: c, phone: pm[0] }); break; }
    }
  }
  for (const em of bodyText.matchAll(new RegExp(EMAIL_RE.source, "g"))) {
    if (FAKE_EMAILS.some((f) => em[0].toLowerCase().includes(f))) continue;
    const idx     = em.index ?? 0;
    const snippet = bodyText.slice(Math.max(0, idx - 120), idx + 40);
    for (const c of snippet.match(NAME_PAT) ?? []) {
      if (isLikelyPersonName(c)) { contacts.push({ name: c, email: em[0] }); break; }
    }
  }

  // 5. Semantic class names
  [
    "[class~='name'],[class~='full-name'],[class~='fullname']",
    "[class*='agent-name'],[class*='staff-name'],[class*='member-name']",
    "[class*='person-name'],[class*='contact-name'],[class*='broker-name']",
    ".fn",
  ].join(",").split(",").forEach((sel) => {
    $(sel.trim()).each((_, el) => {
      const t = $(el).text().trim();
      if (isLikelyPersonName(t)) contacts.push({ name: t });
    });
  });

  // 6. hCard / itemprop fallback
  $("[itemprop='name']").each((_, el) => {
    if (!$(el).closest("[itemtype*='Person']").length) return;
    const t = $(el).text().trim();
    if (isLikelyPersonName(t)) contacts.push({ name: t });
  });
  const authorMeta = $('meta[name="author"]').attr("content") ?? "";
  if (authorMeta && isLikelyPersonName(authorMeta)) contacts.push({ name: authorMeta });

  // 7. tel: and mailto: links — most modern sites use these instead of plain text
  $("a[href^='tel:']").each((_, el) => {
    const raw = $(el).attr("href")?.replace(/^tel:/i, "").trim() ?? "";
    // Normalise: keep only digits, spaces, dashes, parens, +
    const phone = raw.replace(/[^\d\s\-().+]/g, "").trim();
    if (phone.replace(/\D/g, "").length >= 7) contacts.push({ phone });
  });
  $("a[href^='mailto:']").each((_, el) => {
    const raw   = $(el).attr("href")?.replace(/^mailto:/i, "").split("?")[0].trim() ?? "";
    const email = raw.toLowerCase();
    if (email.includes("@") && !FAKE_EMAILS.some((f) => email.includes(f))) {
      contacts.push({ email });
    }
  });

  return contacts;
}

// ─── Lead builder ─────────────────────────────────────────────────────────────

export function parseLead(html: string, url: string): LeadData[] {
  const $ = cheerio.load(html);
  const bodyText = $("body").text();

  const rawEmails    = (bodyText.match(EMAIL_RE) ?? []).filter(
    (e) => !FAKE_EMAILS.some((f) => e.toLowerCase().includes(f))
  );
  const rawPhones    = bodyText.match(PHONE_RE)    ?? [];
  const rawAddresses = bodyText.match(ADDRESS_RE)  ?? [];

  // Also gather tel: / mailto: from links (many sites skip plain-text contacts)
  const telPhones: string[] = [];
  $("a[href^='tel:']").each((_, el) => {
    const p = ($(el).attr("href") ?? "").replace(/^tel:/i, "").trim();
    if (p.replace(/\D/g, "").length >= 7) telPhones.push(p);
  });
  const mailtoEmails: string[] = [];
  $("a[href^='mailto:']").each((_, el) => {
    const e = ($(el).attr("href") ?? "").replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
    if (e.includes("@") && !FAKE_EMAILS.some((f) => e.includes(f))) mailtoEmails.push(e);
  });

  const pageEmails = [...new Set([...rawEmails.map((e) => e.toLowerCase()), ...mailtoEmails])];
  const pagePhones = [...new Set([...rawPhones.map((p) => p.trim()), ...telPhones])];
  if (!pageEmails.length && !pagePhones.length) return [];

  const businessName =
    $('meta[property="og:site_name"]').attr("content") ||
    $("title").text().split(/[|\-–]/)[0].trim() ||
    new URL(url).hostname.replace(/^www\./, "");

  function parseAddress(addr?: string) {
    if (!addr) return {};
    const parts = addr.split(",").map((s) => s.trim());
    return { address: addr, city: parts[parts.length - 2], state: (parts[parts.length - 1] ?? "").split(" ")[0] };
  }

  const contacts = extractContacts(html, url);
  const merged   = new Map<string, Contact>();
  for (const c of contacts) {
    const key = c.email?.toLowerCase() || (c.phone ? digitsOnly(c.phone) : "");
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, c);
    } else {
      if (!existing.name    && c.name)    existing.name    = c.name;
      if (!existing.email   && c.email)   existing.email   = c.email;
      if (!existing.phone   && c.phone)   existing.phone   = c.phone;
      if (!existing.address && c.address) existing.address = c.address;
    }
  }

  const leads:  LeadData[] = [];
  const domain = normalizeWebsite(url);

  if (merged.size > 0) {
    for (const c of merged.values()) {
      leads.push({
        businessName: c.businessName ?? businessName,
        contactPerson: c.name,
        ...parseAddress(c.address ?? rawAddresses[0]),
        city:    c.city  ?? undefined,
        state:   c.state ?? undefined,
        website: domain,
        phone:   c.phone,
        email:   c.email,
        sourceUrl: url,
      });
    }
  } else {
    const count = Math.max(pageEmails.length, pagePhones.length, 1);
    for (let i = 0; i < count; i++) {
      const email = pageEmails[i], phone = pagePhones[i];
      if (!email && !phone) continue;
      leads.push({
        businessName,
        ...(i === 0 ? parseAddress(rawAddresses[0]) : {}),
        website: domain,
        phone,
        email,
        sourceUrl: url,
      });
    }
  }
  return leads;
}
