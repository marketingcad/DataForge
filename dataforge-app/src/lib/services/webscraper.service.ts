import axios from "axios";
import * as cheerio from "cheerio";
import { ScrapedContact, CrawlResult } from "@/types/scraping";
import { normalizeWebsite } from "@/lib/utils/normalize";

const EMAIL_REGEX = /[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const ADDRESS_REGEX = /\d{1,5}\s[\w\s.]{3,40},\s[\w\s]{2,30},?\s[A-Z]{2}\s\d{5}/g;

const FAKE_EMAIL_PATTERNS = ["example.", "@sentry", "@w3.org", "noreply@", "no-reply@", "@email.com", "user@", "test@", "info@example"];
const SKIP_EXTENSIONS = /\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|doc|docx|css|js|woff|woff2|ttf|ico|xml|json)(\?|$)/i;
const SKIP_PATHS = /^(mailto:|tel:|javascript:|#)/i;

const MAX_PAGES = 20;
const REQUEST_TIMEOUT = 8000;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const { data } = await axios.get(url, { timeout: REQUEST_TIMEOUT, headers: HEADERS, maxRedirects: 3 });
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

function extractInternalLinks(html: string, origin: string, domain: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (SKIP_PATHS.test(href) || SKIP_EXTENSIONS.test(href)) return;

    let url: URL;
    try {
      url = new URL(href, origin);
    } catch {
      return;
    }

    // Only same-domain links
    const urlDomain = url.hostname.replace(/^www\./, "");
    if (urlDomain !== domain) return;

    // Normalize: remove hash + trailing slash
    url.hash = "";
    const clean = url.toString().replace(/\/$/, "");
    links.push(clean);
  });

  return [...new Set(links)];
}

function parsePage(html: string, url: string) {
  const $ = cheerio.load(html);
  const text = $("body").text();

  // Emails
  const rawEmails = text.match(EMAIL_REGEX) ?? [];
  const emails = rawEmails.filter(
    (e) => !FAKE_EMAIL_PATTERNS.some((p) => e.toLowerCase().includes(p))
  );

  // Phones
  const phones = text.match(PHONE_REGEX) ?? [];

  // Address
  const addresses = text.match(ADDRESS_REGEX) ?? [];

  // Social links from <a href>
  const socials: CrawlResult["socialLinks"] = {};
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").toLowerCase();
    if (href.includes("linkedin.com")) socials.linkedin = $(el).attr("href")!;
    else if (href.includes("twitter.com") || href.includes("x.com")) socials.twitter = $(el).attr("href")!;
    else if (href.includes("facebook.com")) socials.facebook = $(el).attr("href")!;
    else if (href.includes("instagram.com")) socials.instagram = $(el).attr("href")!;
  });

  // Contact person (Schema.org or meta author)
  let contactPerson: string | undefined;
  const authorMeta = $('meta[name="author"]').attr("content");
  if (authorMeta && authorMeta.length < 60) contactPerson = authorMeta;
  if (!contactPerson) {
    $("[itemprop='name']").each((_, el) => {
      const parent = $(el).closest("[itemtype*='Person']");
      if (parent.length) { contactPerson = $(el).text().trim(); return false; }
    });
  }

  // Title + description (only from homepage-like pages)
  const title =
    $('meta[property="og:site_name"]').attr("content") ||
    $("title").text().split(/[|\-–]/)[0].trim() ||
    undefined;

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    undefined;

  return { emails, phones, addresses, socials, contactPerson, title, description };
}

/**
 * Crawl an entire website (BFS, up to MAX_PAGES pages).
 * Aggregates all emails, phones, social links, and contact info found across pages.
 */
export async function crawlWebsite(rawUrl: string): Promise<CrawlResult> {
  const domain = normalizeWebsite(rawUrl);
  if (!domain) return { domain: rawUrl, emails: [], phones: [], socialLinks: {}, pagesVisited: 0 };

  const origin = `https://${domain}`;
  const visited = new Set<string>();
  const queue: string[] = [origin];

  const allEmails = new Set<string>();
  const allPhones = new Set<string>();
  const allAddresses = new Set<string>();
  let contactPerson: string | undefined;
  let title: string | undefined;
  let description: string | undefined;
  const socialLinks: CrawlResult["socialLinks"] = {};

  // Priority paths — visit these first if not already in queue
  const priority = ["/contact", "/contact-us", "/about", "/about-us", "/team", "/our-team"];
  for (const p of priority) {
    const url = `${origin}${p}`;
    if (!queue.includes(url)) queue.push(url);
  }

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    const html = await fetchHtml(url);
    if (!html) continue;

    const page = parsePage(html, url);

    page.emails.forEach((e) => allEmails.add(e.toLowerCase()));
    page.phones.forEach((p) => allPhones.add(p));
    page.addresses.forEach((a) => allAddresses.add(a));
    if (!contactPerson && page.contactPerson) contactPerson = page.contactPerson;
    if (!title && page.title) title = page.title;
    if (!description && page.description) description = page.description;
    Object.assign(socialLinks, page.socials);

    // Discover more internal links and add to queue
    const links = extractInternalLinks(html, origin, domain);
    for (const link of links) {
      if (!visited.has(link) && !queue.includes(link)) {
        queue.push(link);
      }
    }
  }

  return {
    domain,
    title,
    description,
    emails: [...allEmails],
    phones: [...allPhones],
    addresses: [...allAddresses],
    contactPerson,
    socialLinks,
    pagesVisited: visited.size,
  };
}

/**
 * Legacy single-site scrape — used by the bulk SerpAPI job processor.
 * Returns first email/phone found using the old 3-page approach (fast, low overhead).
 */
export async function scrapeWebsite(rawUrl: string): Promise<ScrapedContact> {
  if (!rawUrl) return {};
  const domain = normalizeWebsite(rawUrl);
  if (!domain) return {};

  const base = `https://${domain}`;
  for (const url of [base, `${base}/contact`, `${base}/about`]) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const { emails, phones, contactPerson } = parsePage(html, url);
    if (emails[0] || phones[0]) return { email: emails[0], phone: phones[0], contactPerson };
  }
  return {};
}
