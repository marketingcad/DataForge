/**
 * Full BFS website crawler — visits up to 20 pages per site.
 * Aggregates all emails, phones, addresses, social links, and contact info.
 */

import { normalizeWebsite } from "@/lib/utils/normalize";
import type { CrawlResult } from "@/types/scraping";
import {
  fetchHtml,
  parsePage,
  extractInternalLinks,
} from "./parser";

const MAX_PAGES = 20;

export async function crawlWebsite(rawUrl: string): Promise<CrawlResult> {
  const domain = normalizeWebsite(rawUrl);
  if (!domain)
    return { domain: rawUrl, emails: [], phones: [], addresses: [], socialLinks: {}, pagesVisited: 0 };

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

  // Priority pages — visit these first
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

    const links = extractInternalLinks(html, origin, domain);
    for (const link of links) {
      if (!visited.has(link) && !queue.includes(link)) queue.push(link);
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
