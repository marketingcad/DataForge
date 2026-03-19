"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Send, Loader2 } from "lucide-react";
import { sendMessageAction, pollMessagesAction } from "@/actions/chat.actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Message = {
  id: string;
  content: string;
  createdAt: Date;
  sender: { id: string; name: string | null; role: string };
};

const ROLE_COLORS: Record<string, string> = {
  boss:            "bg-amber-500",
  admin:           "bg-violet-500",
  sales_rep:       "bg-blue-500",
  lead_specialist: "bg-emerald-500",
};

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getInitials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
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

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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

  function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const content = input.trim();
    if (!content) return;
    setInput("");

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
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? res.message as Message : m));
        lastTimestampRef.current = new Date((res.message as Message).createdAt).toISOString();
      }
    });
  }

  const grouped = messages.reduce<{ msg: Message; showHeader: boolean }[]>((acc, msg, i) => {
    const prev = messages[i - 1];
    acc.push({ msg, showHeader: !prev || prev.sender.id !== msg.sender.id });
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] rounded-xl border bg-card overflow-hidden">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <span className="text-5xl">💬</span>
            <p className="text-sm">No messages yet. Say hi!</p>
          </div>
        )}

        <div className="space-y-1">
          {grouped.map(({ msg, showHeader }) => {
            const isOwn = msg.sender.id === currentUserId;
            return (
              <div key={msg.id} className={`flex gap-2.5 ${isOwn ? "flex-row-reverse" : "flex-row"} ${showHeader ? "mt-4" : ""}`}>
                {showHeader ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className={`text-[11px] font-bold text-white ${ROLE_COLORS[msg.sender.role] ?? "bg-muted-foreground"}`}>
                          {getInitials(msg.sender.name).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent side={isOwn ? "left" : "right"}>
                      <p className="font-medium">{isOwn ? "You" : (msg.sender.name ?? "Unknown")}</p>
                      <p className="text-xs text-muted-foreground capitalize">{msg.sender.role.replace(/_/g, " ")}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="w-8 shrink-0" />
                )}

                <div className={`flex flex-col max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
                  {showHeader && (
                    <div className={`flex items-baseline gap-2 mb-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                      <span className="text-xs font-semibold">{isOwn ? "You" : (msg.sender.name ?? "Unknown")}</span>
                      <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
                    isOwn
                      ? "bg-blue-600 text-white rounded-tr-sm"
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
      </ScrollArea>

      {/* Composer */}
      <form onSubmit={handleSend} className="flex items-center gap-2 border-t px-4 py-3 bg-background">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-full bg-muted border-none focus-visible:ring-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={isPending || !input.trim()}
          className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white shrink-0"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
