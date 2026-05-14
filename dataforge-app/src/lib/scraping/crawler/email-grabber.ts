import * as cheerio from "cheerio";

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const JUNK_DOMAINS = new Set([
  "example.com", "sentry.io", "wixpress.com", "squarespace.com",
  "wordpress.com", "shopify.com", "amazonaws.com", "cloudfront.net",
  "googletagmanager.com", "facebook.com", "twitter.com", "instagram.com",
  "mailchimp.com", "constantcontact.com", "hubspot.com", "salesforce.com",
  "w3.org", "schema.org", "openstreetmap.org",
]);

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
 * 1. mailto: links anywhere on the page
 * 2. Footer (footer tag, class/id containing "footer")
 * 3. Contact section (class/id containing "contact")
 * 4. Sidebar (aside, class/id containing "sidebar")
 * 5. Near a phone number (tel: link siblings)
 * 6. Full page body fallback
 *
 * Each zone scans both href values AND plain text in p/span/div/li/etc.
 * Within each zone, emails matching siteDomain are ranked first.
 */
function extractEmailsFromHtml(html: string, siteDomain?: string): string[] {
  function rank(emails: string[]): string[] {
    if (!siteDomain) return emails;
    const own   = emails.filter((e) => getRootDomain(e.split("@")[1] ?? "") === siteDomain);
    const other = emails.filter((e) => getRootDomain(e.split("@")[1] ?? "") !== siteDomain);
    return [...own, ...other];
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
            !/\.(png|jpg|gif|svg|css|js)$/i.test(domain);
        })
    ).filter((e) => { if (seen.has(e)) return false; seen.add(e); return true; });
  }

  const results: string[] = [];

  // ── Pass 1: raw HTML scan (before any parsing).
  // Catches mailto: hrefs, plain text, JSON data, attributes — everything in the document.
  const rawEmails = [...html.matchAll(EMAIL_RE)].map((m) => m[0]);
  // Also pull mailto: hrefs explicitly (handles cases where the email has ?subject= appended)
  const mailtoRaw = [...html.matchAll(/href=["']mailto:([^"'?\s]+)/gi)].map((m) => m[1]);
  results.push(...collect([...mailtoRaw, ...rawEmails]));

  // ── Pass 2: structured cheerio scan for better zone-based ranking.
  // Strip scripts/styles so their content doesn't pollute zone text extraction.
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  function zoneHtml(sel: string): string {
    return $.html($(sel)) ?? "";
  }

  // Priority zones — emails from these zones are surfaced first via rank()
  const zones = [
    zoneHtml("a[href^='mailto:'], a[href^='MAILTO:']"),
    zoneHtml("footer, [class*='footer' i], [id*='footer' i]"),
    zoneHtml("[class*='contact' i], [id*='contact' i]"),
    zoneHtml("[class*='email' i], [id*='email' i]"),
    zoneHtml("aside, [class*='sidebar' i], [id*='sidebar' i]"),
    zoneHtml("[class*='about' i], [id*='about' i]"),
  ];

  // Siblings of tel: links
  $("a[href^='tel:']").each((_, el) => {
    const parent = $(el).parent();
    zones.push(
      ($.html(parent) ?? "") +
      ($.html(parent.next()) ?? "") +
      ($.html(parent.prev()) ?? "")
    );
  });

  for (const z of zones) {
    if (z) results.push(...collect(scanZone(z)));
  }

  // ── Pass 3: full visible-text scan of the body after tag stripping.
  // Catches anything left — text nodes, inline styles with emails, etc.
  const bodyText = ($.html($("body")) ?? html).replace(/<[^>]+>/g, " ");
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
export async function grabEmailFromWebsite(rawUrl: string): Promise<string | null> {
  const { primary, wwwFallback } = normaliseUrl(rawUrl);

  let siteDomain: string | undefined;
  try { siteDomain = getRootDomain(new URL(primary).hostname); } catch { /* keep undefined */ }

  const PAGE_TIMEOUT = 10_000;

  async function scanPages(base: string): Promise<{ domainEmails: string[]; otherEmails: string[] }> {
    const pages = [
      base,
      resolveUrl(base, "/contact"),
      resolveUrl(base, "/contact-us"),
      resolveUrl(base, "/about"),
    ].filter(Boolean);

    const htmlResults = await Promise.all(pages.map((p) => fetchHtml(p, PAGE_TIMEOUT)));

    const domainEmails: string[] = [];
    const otherEmails:  string[] = [];

    for (const html of htmlResults) {
      if (!html) continue;
      for (const email of extractEmailsFromHtml(html, siteDomain)) {
        const isOwn = siteDomain && getRootDomain(email.split("@")[1] ?? "") === siteDomain;
        if (isOwn) {
          if (!domainEmails.includes(email)) domainEmails.push(email);
        } else {
          if (!otherEmails.includes(email)) otherEmails.push(email);
        }
      }
    }

    return { domainEmails, otherEmails };
  }

  const primary$ = await scanPages(primary);
  if (primary$.domainEmails.length > 0) return primary$.domainEmails[0];
  if (primary$.otherEmails.length > 0) return primary$.otherEmails[0];

  // Nothing found on primary — retry with www. prefix if applicable
  if (wwwFallback) {
    const www$ = await scanPages(wwwFallback);
    if (www$.domainEmails.length > 0) return www$.domainEmails[0];
    if (www$.otherEmails.length > 0) return www$.otherEmails[0];
  }

  return null;
}
