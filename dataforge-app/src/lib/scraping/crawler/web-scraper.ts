/**
 * Legacy single-site scraper — fast 3-page approach (home, /contact, /about).
 * Used by the bulk SerpAPI job processor for high-volume scraping.
 * For deep crawling of individual sites, use web-crawler.ts instead.
 */

import { normalizeWebsite } from "@/lib/utils/normalize";
import type { ScrapedContact } from "@/types/scraping";
import { fetchHtml, parsePage } from "./parser";

export async function scrapeWebsite(rawUrl: string): Promise<ScrapedContact> {
  if (!rawUrl) return {};
  const domain = normalizeWebsite(rawUrl);
  if (!domain) return {};

  const base = `https://${domain}`;
  for (const url of [base, `${base}/contact`, `${base}/about`]) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const { emails, phones, contactPerson } = parsePage(html, url);
    if (emails[0] || phones[0])
      return { email: emails[0], phone: phones[0], contactPerson };
  }
  return {};
}
