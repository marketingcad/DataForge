import { prisma } from "@/lib/prisma";
import type Anthropic from "@anthropic-ai/sdk";
import { runKeywordAutoLoop } from "@/lib/scraping/jobs/processor";

// Context passed to tools — who's asking and whether we're on the desktop app
// (scraper controls are desktop-only, never on the Vercel-hosted web build).
export type ForgerToolContext = { userId: string; isDesktop: boolean };

// ── Forger's tools. READ-ONLY on the database, plus a CSV export (which only
// reads leads and hands the file to the user — it never writes). Any attempt to
// create/update/delete is intentionally NOT offered as a tool; the model is told
// to refuse such requests.

export const FORGER_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_overview",
    description: "High-level counts across DataForge: total scraped leads, unexported leads, number of lead categories, subcategories, folders, and auto-keywords. Use for 'how many leads', 'totals', etc.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_lead_categories",
    description: "List the LEAD categories (industries) and their subcategories with folder + lead counts. Use when asked about available lead categories/subcategories. This is NOT the auto-keyword list.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_keywords",
    description: "List the Auto Keywords (keyword, location, category, saved-lead count, whether auto-running). Use when asked about auto-keyword scrapers.",
    input_schema: {
      type: "object",
      properties: { search: { type: "string", description: "Optional filter on keyword or location text." } },
    },
  },
  {
    name: "search_leads",
    description: "Search saved leads by business name, phone, email, or website. Returns up to 25 matches with basic fields.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Text to search for." } },
      required: ["query"],
    },
  },
  {
    name: "export_leads_csv",
    description: "Export leads to a CSV file the user can download. Filter by category name and/or only-unexported. Use when the user asks to export leads. This only reads data; it produces a file.",
    input_schema: {
      type: "object",
      properties: {
        categoryName: { type: "string", description: "Lead category (industry) name to export from. Omit for all categories." },
        onlyUnexported: { type: "boolean", description: "If true, only export leads not yet exported (exportedAt is null)." },
      },
    },
  },
  {
    name: "start_keyword",
    description: "Start scraping an Auto Keyword (turns on continuous auto-run for it). DESKTOP APP ONLY. Use when the user asks to run/start a specific keyword. Match by keyword text (and optionally location).",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "The keyword text to start (e.g. 'Freight Companies')." },
        location: { type: "string", description: "Optional location to disambiguate if multiple keywords share the text." },
      },
      required: ["keyword"],
    },
  },
  {
    name: "stop_all_scrapers",
    description: "Stop ALL currently running/auto-running keyword scrapers. DESKTOP APP ONLY. Use when the user asks to stop all scrapers.",
    input_schema: { type: "object", properties: {} },
  },
];

export type ForgerToolResult = {
  // Compact text fed back to the model (keep small to save tokens).
  forModel: string;
  // Optional client-side action (e.g. a CSV download) surfaced to the widget.
  action?: { type: "download"; filename: string; content: string; mime: string };
};

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function runForgerTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ForgerToolContext,
): Promise<ForgerToolResult> {
  switch (name) {
    case "get_overview": {
      const [totalLeads, unexported, categories, subcategories, folders, keywords, unfiled] = await Promise.all([
        prisma.lead.count(),
        prisma.lead.count({ where: { exportedAt: null } }),
        prisma.industry.count(),
        prisma.subcategory.count(),
        prisma.folder.count(),
        prisma.scrapingKeyword.count(),
        prisma.lead.count({ where: { folderId: null } }),
      ]);
      return {
        forModel: JSON.stringify({ totalLeads, unexportedLeads: unexported, categories, subcategories, folders, autoKeywords: keywords, unfiledLeads: unfiled }),
      };
    }

    case "list_lead_categories": {
      const industries = await prisma.industry.findMany({
        orderBy: { name: "asc" },
        include: {
          subcategories: { select: { name: true }, orderBy: { name: "asc" } },
          folders: { select: { _count: { select: { leads: true } } } },
        },
      });
      const rows = industries.map((i) => ({
        category: i.name,
        subcategories: i.subcategories.map((s) => s.name),
        folders: i.folders.length,
        leads: i.folders.reduce((n, f) => n + f._count.leads, 0),
      }));
      return { forModel: JSON.stringify(rows) };
    }

    case "list_keywords": {
      const search = typeof input.search === "string" ? input.search.trim().toLowerCase() : "";
      const kws = await prisma.scrapingKeyword.findMany({
        orderBy: { keyword: "asc" },
        select: { keyword: true, location: true, category: true, autoRun: true, _count: { select: { leads: true } } },
      });
      const rows = kws
        .filter((k) => !search || k.keyword.toLowerCase().includes(search) || k.location.toLowerCase().includes(search))
        .slice(0, 60)
        .map((k) => ({ keyword: k.keyword, location: k.location, category: k.category, leads: k._count.leads, autoRunning: k.autoRun }));
      return { forModel: JSON.stringify(rows) };
    }

    case "search_leads": {
      const q = String(input.query ?? "").trim();
      if (!q) return { forModel: "No query provided." };
      const leads = await prisma.lead.findMany({
        where: {
          OR: [
            { businessName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
            { website: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { businessName: true, phone: true, email: true, website: true, city: true, state: true, category: true },
        take: 25,
      });
      return { forModel: JSON.stringify(leads) };
    }

    case "export_leads_csv": {
      const categoryName = typeof input.categoryName === "string" ? input.categoryName.trim() : "";
      const onlyUnexported = input.onlyUnexported === true;

      // Resolve folders for the requested category (if any), then leads in them.
      const where: Record<string, unknown> = {};
      if (categoryName) {
        const industry = await prisma.industry.findFirst({
          where: { name: { equals: categoryName, mode: "insensitive" } },
          include: { folders: { select: { id: true } } },
        });
        if (!industry) return { forModel: `No category named "${categoryName}" was found.` };
        where.folderId = { in: industry.folders.map((f) => f.id) };
      }
      if (onlyUnexported) where.exportedAt = null;

      const leads = await prisma.lead.findMany({
        where,
        select: {
          businessName: true, phone: true, email: true, website: true,
          address: true, city: true, state: true, category: true, dataQualityScore: true,
        },
        take: 5000,
      });

      if (leads.length === 0) {
        return { forModel: `No ${onlyUnexported ? "unexported " : ""}leads found${categoryName ? ` in "${categoryName}"` : ""}.` };
      }

      const header = ["Business Name", "Phone", "Email", "Website", "Address", "City", "State", "Category", "Quality"];
      const lines = [header.join(",")];
      for (const l of leads) {
        lines.push([l.businessName, l.phone, l.email, l.website, l.address, l.city, l.state, l.category, l.dataQualityScore]
          .map(csvEscape).join(","));
      }
      const stamp = categoryName ? categoryName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "all";
      const filename = `leads-${stamp}${onlyUnexported ? "-unexported" : ""}.csv`;
      return {
        forModel: `Prepared a CSV with ${leads.length} lead${leads.length !== 1 ? "s" : ""}${categoryName ? ` from "${categoryName}"` : ""}${onlyUnexported ? " (unexported only)" : ""}. Filename: ${filename}. Tell the user it's ready to download.`,
        action: { type: "download", filename, content: lines.join("\n"), mime: "text/csv" },
      };
    }

    case "start_keyword": {
      if (!ctx.isDesktop) {
        return { forModel: "Starting scrapers only works in the DataForge desktop app, not on the website. Tell the user to do this from the desktop app." };
      }
      const kwText = String(input.keyword ?? "").trim();
      const loc = typeof input.location === "string" ? input.location.trim().toLowerCase() : "";
      if (!kwText) return { forModel: "No keyword provided." };

      const matches = await prisma.scrapingKeyword.findMany({
        where: { keyword: { contains: kwText, mode: "insensitive" } },
        select: { id: true, keyword: true, location: true, autoRun: true },
      });
      const filtered = loc ? matches.filter((m) => m.location.toLowerCase().includes(loc)) : matches;
      if (filtered.length === 0) return { forModel: `No auto-keyword found matching "${kwText}".` };
      if (filtered.length > 1) {
        return { forModel: `Multiple keywords match "${kwText}": ${filtered.map((m) => `"${m.keyword}" in ${m.location}`).join("; ")}. Ask the user which one (by location).` };
      }

      const kw = filtered[0];
      if (kw.autoRun) return { forModel: `"${kw.keyword}" (${kw.location}) is already auto-running.` };

      await prisma.scrapingKeyword.update({
        where: { id: kw.id },
        data: { autoRun: true, autoRunStartedAt: new Date(), enabled: true },
      });
      // Fire-and-forget the continuous loop (persistent desktop server).
      void runKeywordAutoLoop(kw.id, ctx.userId).catch(() => {});
      return { forModel: `Started auto-run for "${kw.keyword}" (${kw.location}). It will keep scraping until stopped.` };
    }

    case "stop_all_scrapers": {
      if (!ctx.isDesktop) {
        return { forModel: "Stopping scrapers only works in the DataForge desktop app, not on the website. Tell the user to do this from the desktop app." };
      }
      const [kwRes] = await Promise.all([
        prisma.scrapingKeyword.updateMany({ where: { autoRun: true }, data: { autoRun: false, autoRunStartedAt: null } }),
        prisma.scrapingJob.updateMany({
          where: { status: { in: ["running", "pending"] } },
          data: { status: "paused", errorMessage: "Stopped by Forger." },
        }),
      ]);
      return { forModel: `Stopped ${kwRes.count} auto-running keyword${kwRes.count !== 1 ? "s" : ""} and signalled any live jobs to stop.` };
    }

    default:
      return { forModel: `Unknown tool: ${name}` };
  }
}
