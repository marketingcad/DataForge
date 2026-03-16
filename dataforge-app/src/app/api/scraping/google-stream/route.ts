import { NextRequest } from "next/server";
import {
  sleep, randInt, sse,
  createBrowserContext,
  humanMouseMove, humanScroll,
} from "@/lib/crawler/core";

export const maxDuration = 60;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SerpLead {
  businessName: string;
  website?:     string;
  phone?:       string;
  address?:     string;
  email?:       string;
  snippet?:     string;
}

// ─── Google SERP extractor ────────────────────────────────────────────────────

/**
 * Navigate to a Google search results page and extract every visible lead
 * (business name, phone, address, website) directly from the rendered DOM.
 * No individual websites are visited.
 */
async function extractFromSerp(
  queryOrUrl: string,
  context: import("playwright").BrowserContext,
  emit: (event: string, data: unknown) => void,
  maxLeads: number
): Promise<SerpLead[]> {
  const page = await context.newPage();
  try {
    const isDirectUrl = queryOrUrl.startsWith("http") && queryOrUrl.includes("google.com");

    if (isDirectUrl) {
      emit("status", { message: "Navigating to Google search results…" });
      await page.goto(queryOrUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    } else {
      emit("status", { message: `Searching Google for: "${queryOrUrl}"…` });
      await page.goto("https://www.google.com", { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await humanMouseMove(page);
      await sleep(randInt(800, 1500));
      const searchBox = page.locator('textarea[name="q"], input[name="q"]').first();
      await searchBox.click();
      await sleep(randInt(200, 500));
      for (const char of queryOrUrl) {
        await page.keyboard.type(char, { delay: randInt(50, 150) });
      }
      await sleep(randInt(400, 800));
      await page.keyboard.press("Enter");
    }

    // Wait for results to render
    await page.waitForSelector("#search, #rso, #rcnt", { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await humanScroll(page);
    await sleep(randInt(600, 1200));

    // Detect CAPTCHA / consent page
    const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
    if (bodyText.includes("captcha") || bodyText.includes("unusual traffic")) {
      emit("status", { message: "Google showed a CAPTCHA — results may be limited" });
    }
    if (bodyText.includes("before you continue") || bodyText.includes("consent.google")) {
      emit("status", { message: "Google consent page — results may be limited" });
    }

    // ── Extract all visible lead data from the live DOM ───────────────────────
    const leads = await page.evaluate((limit: number) => {
      const BLOCKED_HOSTS = ["google.", "youtube.", "facebook.", "twitter.", "instagram.", "linkedin."];
      const seenNames = new Set<string>();
      const out: Array<{
        businessName: string;
        website?: string;
        phone?: string;
        address?: string;
        snippet?: string;
      }> = [];

      function isExternal(href: string) {
        try {
          return href.startsWith("http") && !BLOCKED_HOSTS.some((h) => new URL(href).hostname.includes(h));
        } catch { return false; }
      }

      function cleanPhone(text: string): string | undefined {
        const m = text.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/);
        return m?.[0]?.trim();
      }

      function addLead(lead: typeof out[0]) {
        if (!lead.businessName || out.length >= limit) return;
        const key = lead.businessName.toLowerCase().trim();
        if (seenNames.has(key)) return;
        seenNames.add(key);
        out.push(lead);
      }

      // ── Strategy 1: Local pack / maps results ─────────────────────────────
      // These appear as cards with business name, address, phone, and website link
      const localSelectors = [
        "[data-cid]",
        ".VkpGBb",
        ".rllt__wrap",
        ".cXedhc",
        "div[jsaction*='mouseover'][data-local-attribute]",
        ".uMdZh",       // local services
        ".lj7eLc",      // local pack items
      ];
      document.querySelectorAll(localSelectors.join(", ")).forEach((item) => {
        if (out.length >= limit) return;
        const nameEl = item.querySelector("h3, [class*='OSrXXb'], [class*='dbg0pd'], .fontHeadlineSmall") as HTMLElement | null;
        const name = nameEl?.innerText?.trim() ?? item.querySelector("a[href]")?.textContent?.trim() ?? "";
        if (!name) return;

        const phone = cleanPhone(item.textContent ?? "");
        const addrEl = item.querySelector("[class*='address'], [class*='adr'], [class*='LrzXr']") as HTMLElement | null;
        const address = addrEl?.innerText?.trim();

        const siteA = Array.from(item.querySelectorAll("a[href]"))
          .find((a) => isExternal((a as HTMLAnchorElement).href)) as HTMLAnchorElement | undefined;
        const website = siteA ? new URL(siteA.href).hostname.replace(/^www\./, "") : undefined;

        addLead({ businessName: name, phone, address, website });
      });

      // ── Strategy 2: Knowledge panel (right sidebar) ───────────────────────
      const kp = document.querySelector("#rhs, [data-attrid='title'], .kp-blk");
      if (kp) {
        const name = (kp.querySelector("h2, [data-attrid='title'] span, .qrShPb") as HTMLElement)?.innerText?.trim();
        if (name) {
          const phone = cleanPhone(kp.textContent ?? "");
          const addrEl = kp.querySelector("[data-attrid*='address'], [class*='address']") as HTMLElement | null;
          const address = addrEl?.innerText?.trim();
          const siteA = Array.from(kp.querySelectorAll("a[href]"))
            .find((a) => isExternal((a as HTMLAnchorElement).href)) as HTMLAnchorElement | undefined;
          const website = siteA ? new URL(siteA.href).hostname.replace(/^www\./, "") : undefined;
          addLead({ businessName: name, phone, address, website });
        }
      }

      // ── Strategy 3: Standard organic results (.g blocks) ─────────────────
      document.querySelectorAll("#search .g, #rso .g, #rso > div").forEach((block) => {
        if (out.length >= limit) return;
        const h3 = block.querySelector("h3");
        const a  = block.querySelector("a[href]") as HTMLAnchorElement | null;
        if (!h3 || !a || !isExternal(a.href)) return;

        const name = h3.textContent?.trim() ?? "";
        if (!name) return;

        const snippetEl = block.querySelector("[data-sncf], .VwiC3b, .lEBKkf, [class*='snippet']") as HTMLElement | null;
        const snippet = snippetEl?.innerText?.trim();

        // Mine phone from the snippet / cite area
        const phone = cleanPhone(block.textContent ?? "");
        const website = new URL(a.href).hostname.replace(/^www\./, "");

        addLead({ businessName: name, snippet, phone, website });
      });

      // ── Strategy 4: Fallback — every external h3 link in #search ─────────
      if (out.length === 0) {
        document.querySelectorAll("#search h3, #rso h3").forEach((h3) => {
          if (out.length >= limit) return;
          const a = (h3.closest("a") ?? h3.parentElement?.querySelector("a[href]")) as HTMLAnchorElement | null;
          if (!a || !isExternal(a.href)) return;
          const name = h3.textContent?.trim() ?? "";
          const website = new URL(a.href).hostname.replace(/^www\./, "");
          addLead({ businessName: name, website });
        });
      }

      return out;
    }, maxLeads);

    emit("status", { message: `Extracted ${leads.length} lead${leads.length !== 1 ? "s" : ""} from Google` });
    return leads;
  } catch (err) {
    emit("status", { message: `Extraction error: ${String(err)}` });
    return [];
  } finally {
    await page.close();
  }
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const googleUrl  = (searchParams.get("googleUrl") ?? "").trim();
  const query      = (searchParams.get("query")     ?? "").trim();
  const queryOrUrl = googleUrl || query;
  const maxLeads   = Math.min(parseInt(searchParams.get("maxLeads") ?? "50"), 200);

  if (!queryOrUrl) {
    return new Response(sse("error", { message: "Paste a Google search URL or enter a query" }), {
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const enc  = new TextEncoder();
      const emit = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(sse(event, data)));

      let browser: import("playwright").Browser | null = null;
      let context: import("playwright").BrowserContext | null = null;

      try {
        emit("status", { message: "Launching browser…" });
        const bc = await createBrowserContext();
        browser  = bc.browser;
        context  = bc.context;
      } catch (err) {
        emit("error", { message: `Failed to launch browser: ${String(err)}` });
        controller.close();
        return;
      }

      let leadsFound = 0;
      try {
        const leads = await extractFromSerp(queryOrUrl, context!, emit, maxLeads);

        if (leads.length === 0) {
          emit("error", { message: "No results found on Google. Try a different search query." });
          return;
        }

        for (const lead of leads) {
          leadsFound++;
          emit("lead", { ...lead, index: leadsFound });
        }
      } finally {
        await context?.close();
        await browser?.close();
      }

      emit("done", {
        leadsFound,
        pagesVisited: 1,
        elapsed: Math.round((Date.now() - startTime) / 1000),
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":    "text/event-stream",
      "Cache-Control":   "no-cache",
      Connection:        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
