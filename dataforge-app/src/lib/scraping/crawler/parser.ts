/**
 * Shared HTML fetching and page-parsing helpers.
 * Used by both web-crawler (BFS multi-page) and web-scraper (legacy 3-page).
 */

import axios from "axios";
import * as cheerio from "cheerio";
import type { CrawlResult } from "@/types/scraping";

export const EMAIL_REGEX = /[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/g;
export const PHONE_REGEX = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
export const ADDRESS_REGEX = /\d{1,5}\s[\w\s.]{3,40},\s[\w\s]{2,30},?\s[A-Z]{2}\s\d{5}/g;

export const FAKE_EMAIL_PATTERNS = [
  "example.", "@sentry", "@w3.org", "noreply@", "no-reply@",
  "@email.com", "user@", "test@", "info@example",
];
export const SKIP_EXTENSIONS =
  /\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|doc|docx|css|js|woff|woff2|ttf|ico|xml|json)(\?|$)/i;
export const SKIP_PATHS = /^(mailto:|tel:|javascript:|#)/i;

const REQUEST_TIMEOUT = 8000;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

export async function fetchHtml(url: string): Promise<string | null> {
  try {
    const { data } = await axios.get(url, {
      timeout: REQUEST_TIMEOUT,
      headers: HEADERS,
      maxRedirects: 3,
    });
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

export function extractInternalLinks(
  html: string,
  origin: string,
  domain: string
): string[] {
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

    const urlDomain = url.hostname.replace(/^www\./, "");
    if (urlDomain !== domain) return;

    url.hash = "";
    const clean = url.toString().replace(/\/$/, "");
    links.push(clean);
  });

  return [...new Set(links)];
}

export function parsePage(html: string, url: string) {
  const $ = cheerio.load(html);
  const text = $("body").text();

  const rawEmails = text.match(EMAIL_REGEX) ?? [];
  const emails = rawEmails.filter(
    (e) => !FAKE_EMAIL_PATTERNS.some((p) => e.toLowerCase().includes(p))
  );
  const phones = text.match(PHONE_REGEX) ?? [];
  const addresses = text.match(ADDRESS_REGEX) ?? [];

  const socials: CrawlResult["socialLinks"] = {};
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").toLowerCase();
    if (href.includes("linkedin.com")) socials.linkedin = $(el).attr("href")!;
    else if (href.includes("twitter.com") || href.includes("x.com"))
      socials.twitter = $(el).attr("href")!;
    else if (href.includes("facebook.com")) socials.facebook = $(el).attr("href")!;
    else if (href.includes("instagram.com")) socials.instagram = $(el).attr("href")!;
  });

  let contactPerson: string | undefined;
  const authorMeta = $('meta[name="author"]').attr("content");
  if (authorMeta && authorMeta.length < 60) contactPerson = authorMeta;
  if (!contactPerson) {
    $("[itemprop='name']").each((_, el) => {
      const parent = $(el).closest("[itemtype*='Person']");
      if (parent.length) {
        contactPerson = $(el).text().trim();
        return false;
      }
    });
  }

  const title =
    $('meta[property="og:site_name"]').attr("content") ||
    $("title").text().split(/[|\-–]/)[0].trim() ||
    undefined;

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    undefined;

  void url;
  return { emails, phones, addresses, socials, contactPerson, title, description };
}
