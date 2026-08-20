import { NextRequest } from "next/server";
import { sse, createBrowserContext } from "@/lib/scraping/crawler/core";
import { extractFromSerp } from "@/lib/scraping/google/maps-scraper";

export const maxDuration = 300;

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
      const emit = (event: string, data: unknown) => {
        try { controller.enqueue(enc.encode(sse(event, data))); } catch { /* closed */ }
      };

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
        leadsFound = await extractFromSerp(queryOrUrl, context!, emit, maxLeads);

        if (leadsFound === 0) {
          emit("error", {
            message:
              "No results extracted. Possible causes: CAPTCHA, not a valid Google search URL, " +
              "or no local results found. Try a Maps URL (google.com/search?q=...&udm=1).",
          });
          return;
        }
      } finally {
        await context?.close().catch(() => {});
        await browser?.close().catch(() => {});
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
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
