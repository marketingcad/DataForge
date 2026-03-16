import axios from "axios";
import * as cheerio from "cheerio";
import { ScrapedContact } from "@/types/scraping";
import { normalizeWebsite } from "@/lib/utils/normalize";

const EMAIL_REGEX = /[\w.+\-]+@[\w\-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const { data } = await axios.get(url, { timeout: 8000, headers: HEADERS, maxRedirects: 3 });
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

function extractFromHtml(html: string): ScrapedContact {
  const $ = cheerio.load(html);
  const text = $("body").text();

  const emails = text.match(EMAIL_REGEX) ?? [];
  const phones = text.match(PHONE_REGEX) ?? [];

  // Filter out common false-positive emails
  const filteredEmails = emails.filter(
    (e: string) => !e.includes("example.") && !e.includes("@sentry") && !e.includes("@w3.org")
  );

  // Try to find contact person name
  let contactPerson: string | undefined;
  const authorMeta = $('meta[name="author"]').attr("content");
  if (authorMeta && authorMeta.length < 50) contactPerson = authorMeta;

  if (!contactPerson) {
    $("[itemprop='name']").each((_, el) => {
      const parent = $(el).closest("[itemtype*='Person']");
      if (parent.length) {
        contactPerson = $(el).text().trim();
        return false;
      }
    });
  }

  return {
    email: filteredEmails[0],
    phone: phones[0],
    contactPerson,
  };
}

/**
 * Scrape a website for contact information.
 * Tries homepage first, then /contact and /about as fallbacks.
 */
export async function scrapeWebsite(rawUrl: string): Promise<ScrapedContact> {
  if (!rawUrl) return {};

  const domain = normalizeWebsite(rawUrl);
  if (!domain) return {};

  const baseUrl = `https://${domain}`;
  const pagesToTry = [baseUrl, `${baseUrl}/contact`, `${baseUrl}/about`];

  for (const url of pagesToTry) {
    const html = await fetchHtml(url);
    if (!html) continue;

    const contact = extractFromHtml(html);
    if (contact.email || contact.phone) return contact;
  }

  return {};
}
