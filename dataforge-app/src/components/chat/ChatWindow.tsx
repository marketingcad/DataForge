"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Send } from "lucide-react";
import { sendMessageAction, pollMessagesAction } from "@/actions/chat.actions";

type Message = {
  id: string;
  content: string;
  createdAt: Date;
  sender: { id: string; name: string | null; role: string };
};

const ROLE_COLORS: Record<string, string> = {
  boss:            "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  admin:           "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400",
  sales_rep:       "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  lead_specialist: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
};

function Avatar({ name, role }: { name: string | null; role: string }) {
  return (
    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${ROLE_COLORS[role] ?? "bg-muted text-muted-foreground"}`}>
      {(name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}

export function ChatWindow({ initialMessages, currentUserId }: { initialMessages: Message[]; currentUserId: string }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string>(
    initialMessages.length > 0
      ? new Date(initialMessages[initialMessages.length - 1].createdAt).toISOString()
      : new Date(0).toISOString()
  );

  // Scroll to bottom when new messages arrive
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await pollMessagesAction(lastTimestampRef.current);
      if (res.messages && res.messages.length > 0) {
        lastTimestampRef.current = new Date(res.messages[res.messages.length - 1].createdAt).toISOString();
        setMessages((prev) => [...prev, ...res.messages as Message[]]);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;
    setInput("");

    // Optimistic update
    const optimistic: Message = {
      id: crypto.randomUUID(),
      content,
      createdAt: new Date(),
      sender: { id: currentUserId, name: "You", role: "boss" },
    };
    setMessages((prev) => [...prev, optimistic]);

    startTransition(async () => {
      const res = await sendMessageAction(content);
      if (res.message) {
        // Replace the optimistic message with the real one
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? res.message as Message : m));
        lastTimestampRef.current = new Date((res.message as Message).createdAt).toISOString();
      }
    });
  }

  function formatTime(date: Date) {
    return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  // Group consecutive messages from same sender
  const grouped = messages.reduce<{ msg: Message; showHeader: boolean }[]>((acc, msg, i) => {
    const prev = messages[i - 1];
    const showHeader = !prev || prev.sender.id !== msg.sender.id;
    acc.push({ msg, showHeader });
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] rounded-xl border bg-card overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <span className="text-4xl">💬</span>
            <p className="text-sm">No messages yet. Say hi!</p>
          </div>
        )}
        {grouped.map(({ msg, showHeader }) => {
          const isOwn = msg.sender.id === currentUserId;
          return (
            <div key={msg.id} className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"} ${showHeader ? "mt-3" : ""}`}>
              {showHeader && <Avatar name={msg.sender.name} role={msg.sender.role} />}
              {!showHeader && <div className="w-8 shrink-0" />}
              <div className={`flex flex-col max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
                {showHeader && (
                  <div className={`flex items-baseline gap-1.5 mb-0.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="text-xs font-semibold">{isOwn ? "You" : (msg.sender.name ?? "Unknown")}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                  </div>
                )}
                <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words ${
                  isOwn
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted rounded-tl-sm"
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 border-t px-4 py-3 bg-background">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 bg-muted rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent); } }}
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
