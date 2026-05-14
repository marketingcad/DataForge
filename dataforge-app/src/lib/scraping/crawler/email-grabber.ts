const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Domains that commonly appear in code/images and are never real contact emails
const JUNK_DOMAINS = new Set([
  "example.com", "sentry.io", "wixpress.com", "squarespace.com",
  "wordpress.com", "shopify.com", "amazonaws.com", "cloudfront.net",
  "googletagmanager.com", "facebook.com", "twitter.com", "instagram.com",
]);

function extractEmails(html: string): string[] {
  // Prefer mailto: links — most reliable signal
  const mailtoMatches = [...html.matchAll(/mailto:([^"'\s>?&]+)/gi)]
    .map((m) => m[1].toLowerCase().trim());

  // Also scan plain text
  const textMatches = [...html.matchAll(EMAIL_RE)]
    .map((m) => m[0].toLowerCase().trim());

  const all = [...mailtoMatches, ...textMatches];
  return all.filter((e) => {
    const domain = e.split("@")[1] ?? "";
    return domain && !JUNK_DOMAINS.has(domain) && !domain.includes("example") && !domain.endsWith(".png") && !domain.endsWith(".jpg");
  });
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DataForge/1.0; +https://dataforge.io)" },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function resolveUrl(base: string, path: string): string {
  try {
    return new URL(path, base).href;
  } catch {
    return "";
  }
}

/**
 * Visits a business website and tries to find a contact email.
 * Checks homepage footer/body, then /contact, then /about pages.
 * Returns the first valid email found, or null if none.
 */
export async function grabEmailFromWebsite(rawUrl: string): Promise<string | null> {
  // Normalize URL
  let url = rawUrl.trim();
  if (!url.startsWith("http")) url = `https://${url}`;

  const PAGE_TIMEOUT = 7_000;
  const paths = ["", "/contact", "/about", "/contact-us", "/about-us"];

  for (const path of paths) {
    const target = path ? resolveUrl(url, path) : url;
    if (!target) continue;

    const html = await fetchHtml(target, PAGE_TIMEOUT);
    if (!html) continue;

    const emails = extractEmails(html);
    if (emails.length > 0) return emails[0];
  }

  return null;
}
