import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings/service";
import { DATAFORGE_KNOWLEDGE } from "@/lib/forger/knowledge";
import { FORGER_TOOLS, runForgerTool, type ForgerToolContext } from "@/lib/forger/tools";
import { runForgerViaClaudeCode, type ForgerReply } from "@/lib/forger/agent";
import {
  createConversation, getConversationMessages, addMessage, getOwnedConversation,
} from "@/lib/forger/service";

export const runtime = "nodejs";

// Rough token estimate (≈4 chars/token) — good enough for a pre-flight size guard.
function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const DEFAULT_MODEL = "claude-3-5-haiku-latest";
const MAX_TOOL_ROUNDS = 6;
const HISTORY_WINDOW = 20;

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  const userId = session?.user?.id as string | undefined;
  if (!userId || !role || !["boss", "admin"].includes(role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const message: string = typeof body.message === "string" ? body.message.trim() : "";
  let conversationId: string | undefined = typeof body.conversationId === "string" ? body.conversationId : undefined;
  if (!message) return NextResponse.json({ error: "Empty message." }, { status: 400 });

  const settings = await getSettings();

  // Boss master switch: Forger disabled for everyone.
  if ((settings.disabledFeatures ?? []).includes("forger")) {
    return NextResponse.json({ error: "Forger is currently disabled." }, { status: 403 });
  }

  const apiKey = settings.forgerApiKey || process.env.ANTHROPIC_API_KEY;
  const model = settings.forgerModel || DEFAULT_MODEL;
  const maxRequestTokens = settings.forgerMaxRequestTokens || 6000;
  // Desktop app = local server (no VERCEL env). Claude Code (subscription) + the
  // scraper controls only work here; the Vercel web build uses the API key.
  const isDesktop = !process.env.VERCEL;
  const ctx: ForgerToolContext = { userId, isDesktop };

  // Ensure an owned conversation exists.
  if (conversationId && !(await getOwnedConversation(conversationId, userId))) conversationId = undefined;
  if (!conversationId) conversationId = (await createConversation(userId, message.slice(0, 60))).id;

  // Pre-flight size guard (boss-configurable) — refuse before spending anything.
  if (approxTokens(message) > maxRequestTokens) {
    const refusal = "That request is too big/heavy for me to handle — please shorten it and try again.";
    await addMessage(conversationId, "user", message);
    await addMessage(conversationId, "assistant", refusal);
    return NextResponse.json({ conversationId, reply: refusal, tooLarge: true });
  }

  // History BEFORE this turn (for context), then record the new user message.
  const prior = (await getConversationMessages(conversationId, userId)) ?? [];
  const windowed = prior.slice(-HISTORY_WINDOW);
  await addMessage(conversationId, "user", message);

  const system = `You are Forger, the friendly in-app helper for DataForge (a sales-lead web app). Your ONLY job is to help users USE the product — find pages, understand features, look up their data, export CSVs, and (on desktop) start/stop scrapers.

You are NOT a developer tool and have NO knowledge of DataForge's source code. NEVER reveal, mention, guess, or discuss: source code, file paths, file names, folders, function/variable names, frameworks, databases, or how anything is "built" or "implemented." If a user asks how DataForge is coded/built, or to change/inspect code, reply: "I can only help you use DataForge — I can't help with its code." Then offer to help with a product task instead. Talk like a helpful product guide, never like an engineer.

RULES:
- Use ONLY your provided DataForge tools. You can READ the database and export CSVs. You CANNOT create/edit/delete/register data — if asked, refuse briefly: "I'm not allowed to write anything to the database, but I can read it and help you find things."
- Scraper control (start_keyword / stop_all_scrapers) works ONLY in the desktop app${isDesktop ? " (this IS the desktop app, so it's allowed)" : ", and this is NOT the desktop app — tell the user to do it there"}.
- When pointing to a page, include a Markdown link with the route path, e.g. "[Leads page](/leads)" or "[Auto Keywords](/scraping?tab=keywords)" — they render as clickable in-app links.
- Be concise and friendly. Use tools for real data instead of guessing. Current user role: ${role}.
- FORMATTING: the chat is a narrow panel. Avoid Markdown tables — instead use short bullet lines like "- **Name** — Location · 588 leads". Keep answers compact and scannable.

${DATAFORGE_KNOWLEDGE}`;

  // ── API-key path (web / fallback): Anthropic SDK tool loop ──
  async function viaApi(): Promise<ForgerReply> {
    if (!apiKey) {
      return { reply: "Forger isn't set up yet — open it in the desktop app (which uses your Claude Code login), or a boss can add an Anthropic API key in Settings → Forger." };
    }
    const client = new Anthropic({ apiKey });
    const messages: Anthropic.MessageParam[] = [
      ...windowed.map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: m.content })),
      { role: "user" as const, content: message },
    ];
    let action: ForgerReply["action"];
    let replyText = "";
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const resp = await client.messages.create({ model, max_tokens: 1024, system, tools: FORGER_TOOLS, messages });
      const textParts = resp.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
      if (textParts.length) replyText = textParts.map((t) => t.text).join("\n").trim();
      if (resp.stop_reason !== "tool_use") break;
      const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      messages.push({ role: "assistant", content: resp.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const r = await runForgerTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, ctx);
        if (r.action?.type === "download") action = { filename: r.action.filename, content: r.action.content, mime: r.action.mime };
        results.push({ type: "tool_result", tool_use_id: tu.id, content: r.forModel });
      }
      messages.push({ role: "user", content: results });
    }
    return { reply: replyText || "Sorry, I couldn't produce a response.", action };
  }

  let result: ForgerReply;
  try {
    if (apiKey) {
      // Primary everywhere: one boss-set Anthropic API key works on every device and
      // the web with zero per-user setup (no Claude Code install/login needed).
      result = await viaApi();
    } else if (isDesktop) {
      // No API key set — fall back to the local Claude Code subscription (desktop only).
      const transcript = windowed
        .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
        .join("\n");
      try {
        result = await runForgerViaClaudeCode({ system, transcript, message, ctx });
      } catch (e) {
        console.error("[forger] Claude Code path failed:", e);
        result = { reply: "Forger isn't set up yet. A boss can add an Anthropic API key in Settings → Forger — then Forger works on every device with no extra setup. (Or install Claude Code and run `claude` in a terminal on this device.)" };
      }
    } else {
      // Web with no key configured — viaApi returns the friendly "not set up" message.
      result = await viaApi();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    const failure = /api key|authentication|401/i.test(msg)
      ? "Forger's API key looks invalid — a boss should check it in Settings → Forger."
      : "Forger hit an error. Please try again.";
    await addMessage(conversationId, "assistant", failure);
    return NextResponse.json({ conversationId, reply: failure });
  }

  await addMessage(conversationId, "assistant", result.reply);
  return NextResponse.json({ conversationId, reply: result.reply, action: result.action });
}
