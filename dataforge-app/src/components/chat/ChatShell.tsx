"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import {
  Hash, Lock, Plus, Send, Users, Loader2, Search, X, Check, ChevronDown,
} from "lucide-react";
import { sendMessageAction, pollMessagesAction, createRoomAction, getRoomsAction } from "@/actions/chat.actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ── Types ────────────────────────────────────────────────────────────────────

type RoomMember = { id: string; name: string | null; role: string };
type Room = {
  id: string;
  name: string;
  type: "general" | "group";
  members: { user: RoomMember }[];
  _count: { messages: number };
};
type Message = {
  id: string;
  content: string;
  createdAt: Date;
  sender: { id: string; name: string | null; role: string };
};
type UserItem = { id: string; name: string | null; email: string; role: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_BG: Record<string, string> = {
  boss:            "bg-amber-500",
  admin:           "bg-violet-500",
  sales_rep:       "bg-blue-500",
  lead_specialist: "bg-emerald-500",
};

function initials(name: string | null, email?: string) {
  const n = name ?? email ?? "?";
  const parts = n.trim().split(/[\s@]/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : n.slice(0, 2)).toUpperCase();
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDay(date: Date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ── Create Room Dialog ────────────────────────────────────────────────────────

function CreateRoomDialog({
  open, onClose, allUsers, currentUserId, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  allUsers: UserItem[];
  currentUserId: string;
  onCreated: (room: Room) => void;
}) {
  const [name, setName]           = useState("");
  const [selected, setSelected]   = useState<string[]>([]);
  const [search, setSearch]       = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = allUsers.filter((u) =>
    u.id !== currentUserId &&
    (u.name?.toLowerCase().includes(search.toLowerCase()) ||
     u.email.toLowerCase().includes(search.toLowerCase()))
  );

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function handleCreate() {
    if (!name.trim()) { setError("Group name is required."); return; }
    setError(null);
    startTransition(async () => {
      const res = await createRoomAction(name.trim(), selected);
      if (res.error) { setError(res.error); return; }
      onCreated(res.room as Room);
      setName(""); setSelected([]); setSearch("");
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Leads Team" />
          </div>

          <div className="space-y-2">
            <Label>Add Members</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…" className="pl-8" />
            </div>
            <ScrollArea className="h-44 rounded-lg border">
              <div className="p-2 space-y-1">
                {filtered.map((u) => {
                  const isSelected = selected.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggle(u.id)}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        isSelected ? "bg-blue-600/10 border border-blue-600/30" : "hover:bg-muted"
                      }`}
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className={`text-[10px] font-bold text-white ${ROLE_BG[u.role] ?? "bg-muted-foreground"}`}>
                          {initials(u.name, u.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.name ?? u.email.split("@")[0]}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{u.role.replace(/_/g, " ")}</p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            {selected.length > 0 && (
              <p className="text-xs text-muted-foreground">{selected.length} member{selected.length !== 1 ? "s" : ""} selected</p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={handleCreate} disabled={pending} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Shell ────────────────────────────────────────────────────────────────

export function ChatShell({
  initialRooms,
  initialMessages,
  currentUserId,
  currentUserRole,
  allUsers,
}: {
  initialRooms: Room[];
  initialMessages: Message[];
  currentUserId: string;
  currentUserRole: string;
  allUsers: UserItem[];
}) {
  const [rooms, setRooms]           = useState<Room[]>(initialRooms);
  const [activeRoomId, setActiveRoomId] = useState<string>(initialRooms[0]?.id ?? "");
  const [messages, setMessages]     = useState<Message[]>(initialMessages);
  const [input, setInput]           = useState("");
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastTsRef = useRef<string>(
    initialMessages.length > 0
      ? new Date(initialMessages.at(-1)!.createdAt).toISOString()
      : new Date(0).toISOString()
  );

  const canManage = currentUserRole === "boss" || currentUserRole === "admin";
  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Poll for new messages every 3s
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!activeRoomId) return;
      const res = await pollMessagesAction(activeRoomId, lastTsRef.current);
      if (res.messages?.length) {
        lastTsRef.current = new Date(res.messages.at(-1)!.createdAt).toISOString();
        setMessages((prev) => [...prev, ...res.messages as Message[]]);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeRoomId]);

  async function switchRoom(roomId: string) {
    if (roomId === activeRoomId) return;
    setActiveRoomId(roomId);
    setMessages([]);
    setLoadingRoom(true);
    lastTsRef.current = new Date(0).toISOString();

    // Fetch messages for this room via server action
    const res = await getRoomsAction(); // reload rooms too for counts
    if (res.rooms) setRooms(res.rooms as Room[]);

    // Load messages
    const { pollMessagesAction: poll } = await import("@/actions/chat.actions");
    const msgs = await poll(roomId, new Date(0).toISOString());
    if (msgs.messages) {
      setMessages(msgs.messages as Message[]);
      if (msgs.messages.length) lastTsRef.current = new Date(msgs.messages.at(-1)!.createdAt).toISOString();
    }
    setLoadingRoom(false);
  }

  function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const content = input.trim();
    if (!content || !activeRoomId) return;
    setInput("");

    const optimistic: Message = {
      id: crypto.randomUUID(),
      content,
      createdAt: new Date(),
      sender: { id: currentUserId, name: "You", role: currentUserRole },
    };
    setMessages((prev) => [...prev, optimistic]);

    startTransition(async () => {
      const res = await sendMessageAction(content, activeRoomId);
      if (res.message) {
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? res.message as Message : m));
        lastTsRef.current = new Date((res.message as Message).createdAt).toISOString();
      }
    });
  }

  // Group messages by day + consecutive sender
  type GroupedMsg = { msg: Message; showHeader: boolean; isFirstOfDay: boolean; dayLabel: string };
  const grouped: GroupedMsg[] = messages.reduce<GroupedMsg[]>((acc, msg, i) => {
    const prev = messages[i - 1];
    const msgDay  = new Date(msg.createdAt).toDateString();
    const prevDay = prev ? new Date(prev.createdAt).toDateString() : null;
    const isFirstOfDay  = !prevDay || msgDay !== prevDay;
    const showHeader = isFirstOfDay || !prev || prev.sender.id !== msg.sender.id;
    acc.push({ msg, showHeader, isFirstOfDay, dayLabel: isFirstOfDay ? formatDay(msg.createdAt) : "" });
    return acc;
  }, []);

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl border bg-card overflow-hidden">

      {/* ── Sidebar ── */}
      <div className="w-64 shrink-0 flex flex-col border-r bg-muted/10">
        <div className="flex items-center justify-between px-4 py-3.5 border-b">
          <span className="text-sm font-semibold">Team Chat</span>
          {canManage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New group chat</TooltipContent>
            </Tooltip>
          )}
        </div>

        <ScrollArea className="flex-1 py-2">
          {/* General */}
          <div className="px-3 mb-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">Channels</p>
            {rooms.filter((r) => r.type === "general").map((room) => (
              <button
                key={room.id}
                onClick={() => switchRoom(room.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left transition-colors ${
                  activeRoomId === room.id ? "bg-blue-600 text-white" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Hash className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate font-medium">{room.name}</span>
              </button>
            ))}
          </div>

          <Separator className="my-2" />

          {/* Group rooms */}
          <div className="px-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">Groups</p>
            {rooms.filter((r) => r.type === "group").length === 0 ? (
              <p className="text-xs text-muted-foreground/50 px-2 py-2">
                {canManage ? "Click + to create a group" : "No groups yet"}
              </p>
            ) : (
              rooms.filter((r) => r.type === "group").map((room) => (
                <button
                  key={room.id}
                  onClick={() => switchRoom(room.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left transition-colors ${
                    activeRoomId === room.id ? "bg-blue-600 text-white" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="flex-1 truncate font-medium">{room.name}</span>
                  <Badge variant="secondary" className={`text-[10px] h-4 px-1.5 ${activeRoomId === room.id ? "bg-white/20 text-white border-0" : ""}`}>
                    {room.members.length}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Current user */}
        <div className="border-t px-4 py-3 flex items-center gap-2.5">
          <Avatar className="h-7 w-7">
            <AvatarFallback className={`text-[10px] font-bold text-white ${ROLE_BG[currentUserRole] ?? "bg-muted-foreground"}`}>
              {initials(allUsers.find((u) => u.id === currentUserId)?.name ?? null)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{allUsers.find((u) => u.id === currentUserId)?.name ?? "You"}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{currentUserRole.replace(/_/g, " ")}</p>
          </div>
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b bg-card shrink-0">
          {activeRoom?.type === "general"
            ? <Hash className="h-4 w-4 text-muted-foreground" />
            : <Lock className="h-4 w-4 text-muted-foreground" />
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{activeRoom?.name ?? "Chat"}</p>
            {activeRoom && (
              <p className="text-[11px] text-muted-foreground">
                {activeRoom.type === "general"
                  ? "Everyone in your team"
                  : `${activeRoom.members.length} member${activeRoom.members.length !== 1 ? "s" : ""}`}
              </p>
            )}
          </div>
          {activeRoom?.type === "group" && (
            <div className="flex -space-x-1.5">
              {activeRoom.members.slice(0, 5).map(({ user }) => (
                <Tooltip key={user.id}>
                  <TooltipTrigger asChild>
                    <Avatar className="h-7 w-7 ring-2 ring-background">
                      <AvatarFallback className={`text-[9px] font-bold text-white ${ROLE_BG[user.role] ?? "bg-muted-foreground"}`}>
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>{user.name ?? "Unknown"}</TooltipContent>
                </Tooltip>
              ))}
              {activeRoom.members.length > 5 && (
                <div className="h-7 w-7 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[9px] font-semibold text-muted-foreground">
                  +{activeRoom.members.length - 5}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-5 py-4">
          {loadingRoom ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading messages…</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                {activeRoom?.type === "general" ? <Hash className="h-7 w-7" /> : <Users className="h-7 w-7" />}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Welcome to #{activeRoom?.name}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Be the first to send a message!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {grouped.map(({ msg, showHeader, isFirstOfDay, dayLabel }) => {
                const isOwn = msg.sender.id === currentUserId;
                return (
                  <div key={msg.id}>
                    {isFirstOfDay && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[11px] text-muted-foreground font-medium px-2">{dayLabel}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    <div className={`flex gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"} ${showHeader ? "mt-3" : "mt-0.5"}`}>
                      {showHeader ? (
                        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                          <AvatarFallback className={`text-[11px] font-bold text-white ${ROLE_BG[msg.sender.role] ?? "bg-muted-foreground"}`}>
                            {initials(msg.sender.name)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8 shrink-0" />
                      )}
                      <div className={`flex flex-col max-w-[72%] ${isOwn ? "items-end" : "items-start"}`}>
                        {showHeader && (
                          <div className={`flex items-baseline gap-2 mb-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                            <span className="text-xs font-semibold">{isOwn ? "You" : (msg.sender.name ?? "Unknown")}</span>
                            <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                          </div>
                        )}
                        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                          isOwn
                            ? "bg-blue-600 text-white rounded-tr-sm"
                            : "bg-muted rounded-tl-sm"
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </ScrollArea>

        {/* Composer */}
        <form onSubmit={handleSend} className="flex items-end gap-2 border-t px-4 py-3 bg-background shrink-0">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message #${activeRoom?.name ?? "chat"}…`}
            rows={1}
            className="flex-1 resize-none rounded-xl min-h-[40px] max-h-32 py-2.5 text-sm overflow-auto"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isPending || !input.trim()}
            className="h-10 w-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>

      {/* Create room dialog */}
      <CreateRoomDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        allUsers={allUsers}
        currentUserId={currentUserId}
        onCreated={(room) => {
          setRooms((prev) => [...prev, room]);
          switchRoom(room.id);
        }}
      />
    </div>
  );
}
