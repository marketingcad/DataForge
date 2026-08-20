import * as cheerio from "cheerio";

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const JUNK_DOMAINS = new Set([
  "example.com", "sentry.io", "wixpress.com", "squarespace.com",
  "wordpress.com", "shopify.com", "amazonaws.com", "cloudfront.net",
  "googletagmanager.com", "facebook.com", "twitter.com", "instagram.com",
  "mailchimp.com", "constantcontact.com", "hubspot.com", "salesforce.com",
  "w3.org", "schema.org", "openstreetmap.org",
]);

// Cloudflare Email Obfuscation: /cdn-cgi/l/email-protection#<hex>
// First byte is the XOR key; remaining pairs XOR with it to produce the email.
function decodeCloudflareEmail(encoded: string): string | null {
  try {
    const hex = encoded.startsWith("#") ? encoded.slice(1) : encoded;
    if (hex.length < 4) return null;
    const key = parseInt(hex.slice(0, 2), 16);
    let email = "";
    for (let i = 2; i < hex.length; i += 2) {
      email += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    }
    return email.includes("@") ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}

// Normalise common email obfuscation tricks in visible text before regex scanning.
function deobfuscate(text: string): string {
  return text
    // HTML entities
    .replace(/&#64;|&commat;/gi, "@")
    .replace(/&#46;/gi, ".")
    .replace(/&amp;/gi, "&")
    // Unicode lookalikes for @
    .replace(/＠/g, "@")
    // [at] / (at) / " at " patterns
    .replace(/\s*\[at\]\s*/gi, "@")
    .replace(/\s*\(at\)\s*/gi, "@")
    .replace(/\s*\{at\}\s*/gi, "@")
    .replace(/(?<=[a-z0-9])\s+at\s+(?=[a-z0-9])/gi, "@")
    // [dot] / (dot) patterns
    .replace(/\s*\[dot\]\s*/gi, ".")
    .replace(/\s*\(dot\)\s*/gi, ".")
    .replace(/\s*\{dot\}\s*/gi, ".")
    // Remove spaces inserted inside email-like strings: "info @ domain . com"
    .replace(/([a-z0-9._%+\-])\s*@\s*([a-z0-9.\-])/gi, "$1@$2")
    .replace(/([a-z0-9])\s+\.\s+([a-z]{2,})/gi, "$1.$2");
}

function getRootDomain(hostname: string): string {
  const parts = hostname.replace(/^www\./, "").split(".");
  return parts.length >= 2 ? parts.slice(-2).join(".") : hostname;
}

function parseEmails(text: string): string[] {
  return [...(text.matchAll(EMAIL_RE) ?? [])]
    .map((m) => m[0].toLowerCase().replace(/^mailto:/i, "").trim())
    .filter((e) => {
      const domain = e.split("@")[1] ?? "";
      return (
        domain &&
        !JUNK_DOMAINS.has(domain) &&
        !domain.includes("example") &&
        !domain.endsWith(".png") &&
        !domain.endsWith(".jpg") &&
        !domain.endsWith(".gif") &&
        !domain.endsWith(".svg")
      );
    });
}

/**
 * Scan a chunk of HTML (raw markup) for email addresses.
 * Searches both mailto: hrefs AND plain text content inside any tag (p, span, li, div…).
 */
function scanZone(zoneHtml: string): string[] {
  // mailto: href values
  const mailtoMatches = [...zoneHtml.matchAll(/href=["']mailto:([^"'?\s]+)/gi)]
    .map((m) => m[1].toLowerCase().trim());

  // Strip all HTML tags to get visible text, then scan for @ patterns
  const visibleText = zoneHtml.replace(/<[^>]+>/g, " ");
  const textMatches = [...visibleText.matchAll(EMAIL_RE)]
    .map((m) => m[0].toLowerCase().trim());

  return [...new Set([...mailtoMatches, ...textMatches])];
}

/**
 * Extract emails from a parsed HTML page in priority order:
 * 1. Cloudflare email-protection decoded links
 * 2. mailto: links anywhere on the page
 * 3. Footer / contact / email / sidebar / about zones (deobfuscated text)
 * 4. Full page body fallback (deobfuscated)
 *
 * Within each zone, emails matching siteDomain are ranked first,
 * then free providers (gmail, yahoo, hotmail, outlook), then anything else.
 */
function extractEmailsFromHtml(html: string, siteDomain?: string): string[] {
  const FREE_PROVIDERS = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "protonmail.com"]);

  function rank(emails: string[]): string[] {
    if (!siteDomain) return emails;
    const own   = emails.filter((e) => getRootDomain(e.split("@")[1] ?? "") === siteDomain);
    const free  = emails.filter((e) => FREE_PROVIDERS.has(e.split("@")[1] ?? ""));
    const other = emails.filter((e) => {
      const d = e.split("@")[1] ?? "";
      return getRootDomain(d) !== siteDomain && !FREE_PROVIDERS.has(d);
    });
    return [...own, ...free, ...other];
  }

  const seen = new Set<string>();
  function collect(raw: string[]): string[] {
    return rank(
      raw
        .map((e) => e.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase())
        .filter((e) => {
          const domain = e.split("@")[1] ?? "";
          return domain && !JUNK_DOMAINS.has(domain) &&
            !domain.includes("example") &&
            !/\.(png|jpg|gif|svg|css|js)$/i.test(domain) &&
            e.length < 120;
        })
    ).filter((e) => { if (seen.has(e)) return false; seen.add(e); return true; });
  }

  const results: string[] = [];

  // ── Pass 0: Cloudflare email-protection decoding.
  // Cloudflare rewrites emails to href="/cdn-cgi/l/email-protection#<hex>"
  // and also uses data-cfemail attributes.
  const cfMatches = [
    ...[...html.matchAll(/email-protection#([0-9a-f]+)/gi)].map((m) => m[1]),
    ...[...html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)].map((m) => m[1]),
  ];
  for (const encoded of cfMatches) {
    const decoded = decodeCloudflareEmail(encoded);
    if (decoded) results.push(...collect([decoded]));
  }

  // ── Pass 1: raw HTML scan (before any parsing).
  // Catches mailto: hrefs, plain text, JSON data, attributes — everything in the document.
  const mailtoRaw = [...html.matchAll(/href=["']mailto:([^"'?\s]+)/gi)].map((m) => m[1]);
  const rawEmails = [...deobfuscate(html).matchAll(EMAIL_RE)].map((m) => m[0]);
  results.push(...collect([...mailtoRaw, ...rawEmails]));

  // ── Pass 2: structured cheerio scan for zone-based ranking.
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  function zoneText(sel: string): string {
    return deobfuscate($.html($(sel)) ?? "");
  }

  const zones = [
    zoneText("a[href^='mailto:'], a[href^='MAILTO:']"),
    zoneText("footer, [class*='footer' i], [id*='footer' i]"),
    zoneText("[class*='contact' i], [id*='contact' i]"),
    zoneText("[class*='email' i], [id*='email' i]"),
    zoneText("aside, [class*='sidebar' i], [id*='sidebar' i]"),
    zoneText("[class*='about' i], [id*='about' i]"),
    zoneText("[class*='info' i], [id*='info' i]"),
  ];

  $("a[href^='tel:']").each((_, el) => {
    const parent = $(el).parent();
    zones.push(deobfuscate(
      ($.html(parent) ?? "") +
      ($.html(parent.next()) ?? "") +
      ($.html(parent.prev()) ?? "")
    ));
  });

  for (const z of zones) {
    if (z) results.push(...collect(scanZone(z)));
  }

  // ── Pass 3: full deobfuscated body scan.
  const bodyText = deobfuscate(($.html($("body")) ?? html).replace(/<[^>]+>/g, " "));
  results.push(...collect([...bodyText.matchAll(EMAIL_RE)].map((m) => m[0])));

  return results;
}

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res   = await fetch(url, {
      signal:   ctrl.signal,
      headers:  BROWSER_HEADERS,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function resolveUrl(base: string, path: string): string {
  try { return new URL(path, base).href; } catch { return ""; }
}

const FREE_PROVIDERS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "protonmail.com",
]);

function sameSite(url: string, base: string): boolean {
  try {
    return getRootDomain(new URL(url).hostname) === getRootDomain(new URL(base).hostname);
  } catch { return false; }
}

/**
 * Parse a homepage's own links and return the on-site pages most likely to hold
 * a contact email (Contact / About / Team / Support …). This catches contact
 * pages at non-standard slugs (/reach, /connect, /get-in-touch) that a fixed
 * path-guess list would miss — we follow the site's real navigation instead.
 */
function discoverContactLinks(html: string, base: string): string[] {
  const KEYWORDS = /(contact|about|team|reach|connect|support|get.?in.?touch|enquir|inquir|company|staff|people)/i;
  const found = new Set<string>();
  try {
    const $ = cheerio.load(html);
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const text = ($(el).text() ?? "").trim();
      if (!KEYWORDS.test(href) && !KEYWORDS.test(text)) return;
      const abs = resolveUrl(base, href);
      if (abs && sameSite(abs, base)) found.add(abs.split("#")[0]);
    });
  } catch { /* malformed HTML */ }
  return [...found].slice(0, 6);
}

type Buckets = { domainEmails: string[]; freeEmails: string[]; otherEmails: string[] };

function emptyBuckets(): Buckets {
  return { domainEmails: [], freeEmails: [], otherEmails: [] };
}

function bucketize(buckets: Buckets, html: string, siteDomain?: string): void {
  for (const email of extractEmailsFromHtml(html, siteDomain)) {
    const d = email.split("@")[1] ?? "";
    if (siteDomain && getRootDomain(d) === siteDomain) {
      if (!buckets.domainEmails.includes(email)) buckets.domainEmails.push(email);
    } else if (FREE_PROVIDERS.has(d)) {
      if (!buckets.freeEmails.includes(email)) buckets.freeEmails.push(email);
    } else {
      if (!buckets.otherEmails.includes(email)) buckets.otherEmails.push(email);
    }
  }
}

function bestFromBuckets(b: Buckets): string | null {
  return b.domainEmails[0] ?? b.freeEmails[0] ?? b.otherEmails[0] ?? null;
}

/**
 * Normalise a raw URL: ensure https://, then try www. variant as a fallback
 * if the bare domain returns no results.
 */
function normaliseUrl(raw: string): { primary: string; wwwFallback: string | null } {
  let url = raw.trim();
  if (!url.startsWith("http")) url = `https://${url}`;
  try {
    const u = new URL(url);
    // If already has www. there's no www variant to add; if it's bare, build one
    const wwwFallback = u.hostname.startsWith("www.")
      ? null
      : `${u.protocol}//www.${u.hostname}${u.pathname}${u.search}`;
    return { primary: url, wwwFallback };
  } catch {
    return { primary: url, wwwFallback: null };
  }
}

/**
 * Visits a business website (homepage + contact pages) and returns the best email found.
 * Fetch order: primary URL first; if that yields nothing, try the www. variant.
 * On each page the search order is:
 *   mailto: link → footer → contact section → sidebar → near phone → full body
 * Emails matching the site's own domain are always preferred over gmail/yahoo/etc.
 */
export async function grabEmailFromWebsite(
  rawUrl: string,
  // When a context getter is supplied, sites where the fast fetch scan finds
  // nothing (typically JavaScript-rendered pages — Wix, Squarespace, React/Next)
  // are retried by LOADING the page in a headless tab so its JS runs, then
  // scanning the rendered HTML. The getter is LAZY — it's only called when a
  // fallback is actually needed, so a run where every site resolves via fetch
  // never launches a browser. The context blocks images/media/fonts → light.
  opts?: { getContext?: () => Promise<import("playwright").BrowserContext | null> },
): Promise<string | null> {
  const { primary, wwwFallback } = normaliseUrl(rawUrl);

  let siteDomain: string | undefined;
  try { siteDomain = getRootDomain(new URL(primary).hostname); } catch { /* keep undefined */ }

  const PAGE_TIMEOUT = 6_000;

  // ── Fast path: plain fetch (no browser). Homepage first so we can follow its
  // own Contact/About links, then guessed paths + discovered links in parallel.
  async function scanPagesStatic(base: string): Promise<Buckets> {
    const buckets = emptyBuckets();

    const homeHtml = await fetchHtml(base, PAGE_TIMEOUT);
    if (homeHtml) bucketize(buckets, homeHtml, siteDomain);

    const guessed = [
      "/contact", "/contact-us", "/contactus", "/contact.html", "/contact.php",
      "/get-in-touch", "/reach-us", "/reach", "/connect", "/support",
      "/about", "/about-us", "/team", "/our-team",
    ].map((p) => resolveUrl(base, p));
    const discovered = homeHtml ? discoverContactLinks(homeHtml, base) : [];

    const pages = [...new Set([...guessed, ...discovered].filter(Boolean))]
      .filter((p) => p !== base);

    const htmlResults = await Promise.all(pages.map((p) => fetchHtml(p, PAGE_TIMEOUT)));
    for (const html of htmlResults) {
      if (html) bucketize(buckets, html, siteDomain);
    }
    return buckets;
  }

  // ── Rendered path: load pages in a headless tab so client-side JS runs, then
  // scan the resulting DOM. Homepage + its Contact/About links, capped tight.
  async function scanPagesRendered(base: string): Promise<Buckets> {
    const buckets = emptyBuckets();
    const context = opts?.getContext ? await opts.getContext() : null;
    if (!context) return buckets;

    const page = await context.newPage();
    try {
      page.setDefaultTimeout(10_000);

      const loadAndScan = async (url: string): Promise<string | null> => {
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12_000 });
          // Give client-side JS a moment to inject the email, but don't hang.
          await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
          const html = await page.content();
          bucketize(buckets, html, siteDomain);
          return html;
        } catch { return null; }
      };

      const homeHtml = await loadAndScan(base);
      if (buckets.domainEmails.length > 0) return buckets;

      // Follow up to 2 of the site's own contact-ish links from the rendered DOM.
      const links = homeHtml ? discoverContactLinks(homeHtml, base).slice(0, 2) : [];
      for (const link of links) {
        await loadAndScan(link);
        if (buckets.domainEmails.length > 0) break;
      }
      return buckets;
    } finally {
      await page.close().catch(() => {});
    }
  }

  // 1) Fast fetch on primary, then www. variant.
  let result = bestFromBuckets(await scanPagesStatic(primary));
  if (result) return result;
  if (wwwFallback) {
    result = bestFromBuckets(await scanPagesStatic(wwwFallback));
    if (result) return result;
  }

  // 2) Nothing from static HTML — likely JS-rendered. Retry in a tab if we can.
  if (opts?.getContext) {
    result = bestFromBuckets(await scanPagesRendered(primary));
    if (result) return result;
  }

  return null;
}
