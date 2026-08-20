import { tmpdir } from "node:os";
import { z } from "zod";
import { runForgerTool, type ForgerToolContext } from "./tools";

export type ForgerReply = {
  reply: string;
  action?: { filename: string; content: string; mime: string };
};

// Powers Forger via the user's LOGGED-IN Claude Code (subscription auth, no API
// key). The Agent SDK spawns the local `claude` CLI, so this only works on the
// desktop app where Claude Code is installed + logged in. Our DB tools are
// exposed as in-process MCP tools; the model is restricted to ONLY those.
export async function runForgerViaClaudeCode(opts: {
  system: string;
  transcript: string;
  message: string;
  ctx: ForgerToolContext;
}): Promise<ForgerReply> {
  // Non-literal specifier + dynamic import so the project still builds when the
  // optional SDK isn't installed (it's required only for this desktop path).
  const pkg = "@anthropic-ai/claude-agent-sdk";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdk: any = await import(pkg as string);
  const { query, tool, createSdkMcpServer } = sdk;

  let action: ForgerReply["action"];

  // [name, description, zod shape]
  const defs: Array<[string, string, Record<string, unknown>]> = [
    ["get_overview", "High-level counts: total leads, unexported leads, categories, subcategories, folders, auto-keywords.", {}],
    ["list_lead_categories", "List LEAD categories and their subcategories with folder + lead counts. Not the auto-keyword list.", {}],
    ["list_keywords", "List Auto Keywords (keyword, location, category, saved-lead count, auto-run status).", { search: z.string().optional() }],
    ["search_leads", "Search saved leads by business name, phone, email, or website.", { query: z.string() }],
    ["export_leads_csv", "Export leads to a downloadable CSV. Optional categoryName and onlyUnexported filters.", { categoryName: z.string().optional(), onlyUnexported: z.boolean().optional() }],
    ["start_keyword", "Start (auto-run) an Auto Keyword scraper. Desktop app only.", { keyword: z.string(), location: z.string().optional() }],
    ["stop_all_scrapers", "Stop all running / auto-running keyword scrapers. Desktop app only.", {}],
  ];

  const tools = defs.map(([name, desc, shape]) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tool(name, desc, shape, async (args: any) => {
      const r = await runForgerTool(name, (args ?? {}) as Record<string, unknown>, opts.ctx);
      if (r.action?.type === "download") {
        action = { filename: r.action.filename, content: r.action.content, mime: r.action.mime };
      }
      return { content: [{ type: "text", text: r.forModel }] };
    })
  );

  const server = createSdkMcpServer({ name: "dataforge", version: "1.0.0", tools });
  const allowed = defs.map(([name]) => `mcp__dataforge__${name}`);

  const prompt = opts.transcript ? `${opts.transcript}\n\nUser: ${opts.message}` : opts.message;

  let finalText = "";
  for await (const m of query({
    prompt,
    options: {
      // FULL replacement of the system prompt — do NOT append to Claude Code's
      // default coding-agent prompt, or Forger starts documenting source files.
      systemPrompt: opts.system,
      // Neutral cwd + no filesystem settings so it has zero project/code context.
      cwd: tmpdir(),
      settingSources: [],
      mcpServers: { dataforge: server },
      allowedTools: allowed,
      // Deny anything that isn't one of our tools — no filesystem/bash, no prompts.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canUseTool: async (toolName: string, input: any) =>
        allowed.includes(toolName)
          ? { behavior: "allow", updatedInput: input }
          : { behavior: "deny", message: "Forger may only use its own tools." },
      maxTurns: 6,
    },
  })) {
    if (m.type === "result") {
      if (m.subtype === "success") finalText = m.result ?? "";
      break;
    }
  }

  return { reply: finalText || "Sorry, I couldn't produce a response.", action };
}
