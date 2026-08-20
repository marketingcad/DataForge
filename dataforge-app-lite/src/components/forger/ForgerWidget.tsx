"use client";

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Send, Plus, Trash2, MessageSquare, ArrowLeft, Users, Layers, Wand2, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getForgerConversationsAction, createForgerConversationAction,
  getForgerMessagesAction, deleteForgerConversationAction, deleteAllForgerConversationsAction,
} from "@/actions/forger.actions";

type Msg = { id?: string; role: "user" | "assistant"; content: string };
type Convo = { id: string; title: string; updatedAt: string | Date };

// Colorful starter prompts shown on the empty state.
const SUGGESTIONS: { label: string; text: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { label: "Lead count", text: "How many leads do we have in total?", icon: Users, color: "text-violet-500" },
  { label: "Categories", text: "Show me all lead categories and subcategories", icon: Layers, color: "text-amber-500" },
  { label: "Auto Keywords", text: "Where is the Auto Keywords page?", icon: Wand2, color: "text-blue-500" },
];

// ── Lightweight, dependency-free markdown for chat bubbles: paragraphs, bullet
// lists, **bold**, `inline code`, and [label](href) links (internal → router). ──
function renderInline(text: string, onNavigate: (href: string) => void, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("[")) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      if (mm) {
        const [, label, href] = mm;
        const internal = href.startsWith("/");
        nodes.push(
          <a
            key={key}
            href={href}
            onClick={(e) => { if (internal) { e.preventDefault(); onNavigate(href); } }}
            target={internal ? undefined : "_blank"}
            rel={internal ? undefined : "noopener noreferrer"}
            className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
          >
            {label}
          </a>
        );
      }
    } else if (tok.startsWith("**")) {
      nodes.push(<strong key={key} className="font-semibold">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(<code key={key} className="rounded bg-background/60 px-1 py-0.5 text-[0.85em] font-mono">{tok.slice(1, -1)}</code>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function RichText({ text, onNavigate }: { text: string; onNavigate: (href: string) => void }) {
  const blocks = text.trim().split(/\n{2,}/); // paragraphs separated by blank lines
  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");

        // Markdown pipe table → compact scrollable table.
        const isTable =
          lines.length >= 2 &&
          lines[0].includes("|") &&
          /^[\s|:-]+$/.test(lines[1]) && lines[1].includes("-");
        if (isTable) {
          const parseRow = (line: string) => {
            const cells = line.split("|").map((s) => s.trim());
            if (cells[0] === "") cells.shift();
            if (cells.length && cells[cells.length - 1] === "") cells.pop();
            return cells;
          };
          const header = parseRow(lines[0]);
          const rows = lines.slice(2).map(parseRow);
          return (
            <div key={bi} className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    {header.map((h, hi) => (
                      <th key={hi} className="whitespace-nowrap px-2 py-1.5 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={ri} className="border-t border-border/40">
                      {r.map((c, ci) => (
                        <td key={ci} className="px-2 py-1.5 align-top">{renderInline(c, onNavigate, `${bi}-${ri}-${ci}`)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const isList = lines.length > 0 && lines.every((l) => /^\s*[-*]\s+/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-4">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*[-*]\s+/, ""), onNavigate, `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {renderInline(l, onNavigate, `${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function formatWhen(d: string | Date): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function downloadCsv(filename: string, content: string, mime: string) {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch { /* ignore */ }
}

export function ForgerWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [panelWidth, setPanelWidth] = useState(460);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(460);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  // Restore a saved panel width, else default to 40% of the screen (clamped).
  useEffect(() => {
    const saved = Number(localStorage.getItem("forger-width"));
    const initial = saved >= 360
      ? saved
      : Math.max(360, Math.min(Math.round(window.innerWidth * 0.4), 900));
    widthRef.current = initial;
    setPanelWidth(initial);
  }, []);

  // Drag the left edge to resize the panel width (it's anchored bottom-right).
  const onDragMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startX - e.clientX; // drag left → wider
    const max = Math.min(window.innerWidth - 40, 820);
    const w = Math.max(360, Math.min(max, dragRef.current.startW + delta));
    widthRef.current = w;
    setPanelWidth(w);
  }, []);
  const onDragEnd = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
    try { localStorage.setItem("forger-width", String(widthRef.current)); } catch { /* ignore */ }
  }, [onDragMove]);
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: widthRef.current };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  }, [onDragMove, onDragEnd]);

  // Grow the composer with its content, up to a max height (then it scrolls).
  const autoGrow = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  // Load conversation list the first time the panel opens.
  useEffect(() => {
    if (!open) return;
    getForgerConversationsAction().then((c) => setConvos(c as Convo[])).catch(() => {});
  }, [open]);

  // After each new message: if it's Forger's reply, scroll so the START of the
  // reply is at the top (so you read from the beginning); if it's your own
  // message, jump to the bottom so you see it + the typing indicator.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.role === "assistant") {
      requestAnimationFrame(() => lastMsgRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    } else {
      scrollToEnd();
    }
  }, [messages, scrollToEnd]);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  async function openConversation(id: string) {
    setConversationId(id);
    setShowHistory(false);
    setMessages([]);
    const msgs = await getForgerMessagesAction(id).catch(() => []);
    setMessages(msgs.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })));
  }

  function newChat() {
    setConversationId(undefined);
    setMessages([]);
    setShowHistory(false);
  }

  async function removeConversation(id: string) {
    await deleteForgerConversationAction(id).catch(() => {});
    setConvos((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) newChat();
  }

  async function clearAllConversations() {
    await deleteAllForgerConversationsAction().catch(() => {});
    setConvos([]);
    setConfirmClear(false);
    newChat();
  }

  async function send(preset?: string) {
    const text = (preset ?? input).trim();
    if (!text || sending) return;
    if (!preset) {
      setInput("");
      if (inputRef.current) inputRef.current.style.height = "auto"; // shrink back to one line
    }
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await fetch("/api/forger/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json();
      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        // refresh the history list so the new convo shows up
        getForgerConversationsAction().then((c) => setConvos(c as Convo[])).catch(() => {});
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? data.error ?? "No response." }]);
      if (data.action?.filename) downloadCsv(data.action.filename, data.action.content, data.action.mime ?? "text/csv");
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong reaching Forger." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Ask Forger"
          className="group fixed bottom-5 right-5 z-50 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-1 ring-white/10 transition-all hover:scale-105 hover:bg-blue-700 hover:shadow-blue-600/50 active:scale-95"
        >
          <Sparkles className="h-5 w-5 transition-transform group-hover:rotate-12" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <>
          {/* Blurred backdrop — click to close */}
          <div
            onClick={() => setOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-background/30 backdrop-blur-sm"
          />
          <div
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl",
            expanded
              ? "inset-6" // full-screen mode — small inset so the app still peeks behind
              : "bottom-5 right-5 h-[560px] max-h-[calc(100vh-2.5rem)] max-w-[calc(100vw-2.5rem)]"
          )}
          style={expanded ? undefined : { width: panelWidth }}
        >
          {/* Drag-to-resize handle (left edge) — docked mode only */}
          {!expanded && (
            <div
              onMouseDown={onDragStart}
              title="Drag to resize"
              className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize hover:bg-blue-500/30"
            />
          )}
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b bg-gradient-to-r from-blue-500/10 to-transparent px-3 py-2.5 shrink-0">
            {showHistory ? (
              <button onClick={() => { setShowHistory(false); setConfirmClear(false); }} className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Back">
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none">Forger</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                {!showHistory && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                {showHistory ? "Chat history" : "AI assistant · read-only"}
              </p>
            </div>
            {!showHistory && (
              <>
                <button onClick={() => { setShowHistory(true); setConfirmClear(false); }} className="cursor-pointer rounded-lg p-1.5 text-blue-500 hover:bg-blue-500/10 transition-colors" title="History">
                  <MessageSquare className="h-4 w-4" />
                </button>
                <button onClick={newChat} className="cursor-pointer rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-500/10 transition-colors" title="New chat">
                  <Plus className="h-4 w-4" />
                </button>
              </>
            )}
            <button onClick={() => setExpanded((v) => !v)} className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title={expanded ? "Exit full screen" : "Full screen"}>
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button onClick={() => setOpen(false)} className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors" title="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {showHistory ? (
            /* History list */
            <div className="flex flex-1 flex-col overflow-hidden">
              {convos.length > 0 && (
                <div className="flex items-center justify-between border-b px-3 py-2 shrink-0">
                  <span className="text-[11px] text-muted-foreground">
                    {convos.length} conversation{convos.length !== 1 ? "s" : ""}
                  </span>
                  {confirmClear ? (
                    <span className="flex items-center gap-2 text-[11px]">
                      <span className="text-muted-foreground">Delete all?</span>
                      <button onClick={clearAllConversations} className="cursor-pointer font-semibold text-destructive hover:underline">Yes</button>
                      <button onClick={() => setConfirmClear(false)} className="cursor-pointer text-muted-foreground hover:underline">No</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmClear(true)} className="flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3 w-3" /> Clear all
                    </button>
                  )}
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {convos.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No conversations yet.</p>
              )}
              {convos.map((c) => (
                <div key={c.id} className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/60">
                  <button onClick={() => openConversation(c.id)} className="flex-1 min-w-0 cursor-pointer text-left">
                    <p className="text-xs font-medium truncate">{c.title || "Untitled"}</p>
                    {c.updatedAt && (
                      <p className="text-[10px] text-muted-foreground mt-0.5" suppressHydrationWarning>{formatWhen(c.updatedAt)}</p>
                    )}
                  </button>
                  <button onClick={() => removeConversation(c.id)} className="cursor-pointer rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-4">
                {messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
                      <Sparkles className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Hi, I&apos;m Forger 👋</p>
                      <p className="mx-auto mt-1 max-w-[15rem] text-xs leading-relaxed text-muted-foreground">
                        Your DataForge helper — find pages, look up leads &amp; categories, or export a CSV.
                      </p>
                    </div>
                    <div className="flex w-full flex-col gap-1.5 pt-1">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => send(s.text)}
                          className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/60 bg-background px-3 py-2 text-left text-xs text-foreground/90 transition-colors hover:border-border hover:bg-muted/60"
                        >
                          <s.icon className={cn("h-4 w-4 shrink-0", s.color)} />
                          <span className="truncate">{s.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={m.id ?? i} ref={i === messages.length - 1 ? lastMsgRef : null} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                    {m.role === "assistant" && (
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-sm",
                      m.role === "user"
                        ? "rounded-br-md bg-gradient-to-br from-indigo-500 to-blue-600 text-white"
                        : "rounded-bl-md border border-border/60 bg-background text-foreground"
                    )}>
                      {m.role === "assistant"
                        ? <RichText text={m.content} onNavigate={navigate} />
                        : m.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start gap-2">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border/60 bg-background px-3.5 py-3">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                    </div>
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="border-t p-2.5 shrink-0">
                <div className="flex items-end gap-2 rounded-2xl border bg-background px-2.5 py-2 transition-colors focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); autoGrow(); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Ask Forger…"
                    rows={1}
                    className="flex-1 resize-none self-center bg-transparent text-sm outline-none overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    style={{ maxHeight: 128 }}
                  />
                  <Button
                    size="icon"
                    className="h-8 w-8 shrink-0 cursor-pointer self-end rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed"
                    onClick={() => send()}
                    disabled={sending || !input.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1.5 text-center text-[10px] text-muted-foreground">Forger reads your data (no edits) and can export CSVs.</p>
              </div>
            </>
          )}
          </div>
        </>
      )}
    </>
  );
}
